<?php
require_once __DIR__ . '/../config/dbconnection.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS, PUT, DELETE');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');

// Handle CORS preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Get database connection
$conn = getDBConnection();

try {
    // Get the request method
    $method = $_SERVER['REQUEST_METHOD'];
    $action = $_GET['action'] ?? '';

    // Helper function to send JSON response
    function sendResponse($status, $data = null, $message = '') {
        $response = ['status' => $status];
        if ($data !== null) $response['data'] = $data;
        if ($message) $response['message'] = $message;
        echo json_encode($response);
        exit();
    }

    // Handle different actions
    switch ($action) {
        case 'like':
            handleLikeAction($conn);
            break;
        case 'comment':
            handleCommentAction($conn);
            break;
        case 'share':
            handleShareAction($conn);
            break;
        case 'get-comments':
            handleGetComments($conn);
            break;
        case 'get-likes':
            handleGetLikes($conn);
            break;
        default:
            // Default to post handling if no specific action
            if ($method === 'GET') {
                handleGetPosts($conn);
            } elseif ($method === 'POST') {
                handleCreatePost($conn);
            } else {
                throw new Exception('Method not allowed', 405);
            }
    }
} catch (Exception $e) {
    $statusCode = $e->getCode() ?: 500;
    http_response_code($statusCode);
    sendResponse('error', null, $e->getMessage());
} finally {
    $conn->close();
}

// Handle getting all posts
function handleGetPosts($conn) {
    $query = "
        SELECT p.*, 
               u.name as user_name, 
               u.profile_image,
               (SELECT COUNT(*) FROM post_likes WHERE post_id = p.id) as like_count,
               (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comment_count
        FROM posts p
        JOIN users u ON p.user_id = u.id
        ORDER BY p.created_at DESC
    ";
    
    $result = $conn->query($query);
    $posts = [];
    
    if ($result && $result->num_rows > 0) {
        while($row = $result->fetch_assoc()) {
            $row['is_liked'] = false; // Will be set by frontend based on user's like status
            $posts[] = $row;
        }
    }
    
    sendResponse('success', $posts);
}

// Handle creating a new post
function handleCreatePost($conn) {
    // Check if required fields are present
    if (empty($_POST['content']) || empty($_POST['user_id'])) {
        throw new Exception('Content and user ID are required', 400);
    }

    // Handle file upload
    $imagePath = null;
    if (isset($_FILES['image']) && $_FILES['image']['error'] === UPLOAD_ERR_OK) {
        $uploadDir = __DIR__ . '/../../uploads/posts/';
        if (!file_exists($uploadDir)) {
            mkdir($uploadDir, 0777, true);
        }

        // Generate a unique filename
        $fileExt = strtolower(pathinfo($_FILES['image']['name'], PATHINFO_EXTENSION));
        $allowedExts = ['jpg', 'jpeg', 'png', 'gif'];
        
        if (!in_array($fileExt, $allowedExts)) {
            throw new Exception('Only JPG, JPEG, PNG & GIF files are allowed', 400);
        }
        
        $fileName = uniqid() . '.' . $fileExt;
        $targetPath = $uploadDir . $fileName;

        // Move the uploaded file
        if (move_uploaded_file($_FILES['image']['tmp_name'], $targetPath)) {
            $imagePath = 'uploads/posts/' . $fileName;
        }
    }

    // Prepare data
    $content = $conn->real_escape_string($_POST['content']);
    $userId = (int)$_POST['user_id'];
    $imagePathValue = $imagePath ? "'" . $conn->real_escape_string($imagePath) . "'" : "NULL";

    // Insert into database
    $query = "INSERT INTO posts (user_id, content, image_path, created_at) 
             VALUES ($userId, '$content', $imagePathValue, NOW())";

    if ($conn->query($query)) {
        $postId = $conn->insert_id;
        
        // Get the newly created post
        $result = $conn->query("
            SELECT p.*, u.name as user_name, u.profile_image, 
                   0 as like_count, 0 as comment_count, 0 as is_liked
            FROM posts p
            JOIN users u ON p.user_id = u.id
            WHERE p.id = $postId
        ");
        
        $newPost = $result->fetch_assoc();
        
        sendResponse('success', $newPost, 'Post created successfully');
    } else {
        throw new Exception('Failed to save post: ' . $conn->error, 500);
    }
}

// Handle like/unlike action
function handleLikeAction($conn) {
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (empty($input['post_id']) || empty($input['user_id'])) {
        throw new Exception('Post ID and user ID are required', 400);
    }
    
    $postId = (int)$input['post_id'];
    $userId = (int)$input['user_id'];
    
    // Check if already liked
    $check = $conn->query("SELECT id FROM post_likes WHERE post_id = $postId AND user_id = $userId");
    
    if ($check->num_rows > 0) {
        // Unlike
        $conn->query("DELETE FROM post_likes WHERE post_id = $postId AND user_id = $userId");
        $action = 'unliked';
    } else {
        // Like
        $conn->query("INSERT INTO post_likes (post_id, user_id, created_at) VALUES ($postId, $userId, NOW())");
        $action = 'liked';
    }
    
    // Get updated like count
    $result = $conn->query("SELECT COUNT(*) as like_count FROM post_likes WHERE post_id = $postId");
    $likeCount = $result->fetch_assoc()['like_count'];
    
    sendResponse('success', [
        'action' => $action,
        'like_count' => (int)$likeCount,
        'is_liked' => $action === 'liked'
    ]);
}

// Handle adding a comment
function handleCommentAction($conn) {
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (empty($input['post_id']) || empty($input['user_id']) || empty($input['content'])) {
        throw new Exception('Post ID, user ID, and content are required', 400);
    }
    
    $postId = (int)$input['post_id'];
    $userId = (int)$input['user_id'];
    $content = $conn->real_escape_string($input['content']);
    
    // Insert comment
    $query = "INSERT INTO comments (post_id, user_id, content, created_at) 
              VALUES ($postId, $userId, '$content', NOW())";
    
    if ($conn->query($query)) {
        $commentId = $conn->insert_id;
        
        // Get the new comment with user info
        $result = $conn->query("
            SELECT c.*, u.name as user_name, u.profile_image
            FROM comments c
            JOIN users u ON c.user_id = u.id
            WHERE c.id = $commentId
        ");
        
        $newComment = $result->fetch_assoc();
        
        // Update comment count
        $countResult = $conn->query("
            SELECT COUNT(*) as comment_count 
            FROM comments 
            WHERE post_id = $postId
        ");
        $commentCount = $countResult->fetch_assoc()['comment_count'];
        
        sendResponse('success', [
            'comment' => $newComment,
            'comment_count' => (int)$commentCount
        ], 'Comment added successfully');
    } else {
        throw new Exception('Failed to add comment: ' . $conn->error, 500);
    }
}

// Handle share action
function handleShareAction($conn) {
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (empty($input['post_id']) || empty($input['user_id'])) {
        throw new Exception('Post ID and user ID are required', 400);
    }
    
    $postId = (int)$input['post_id'];
    $userId = (int)$input['user_id'];
    
    // Get the original post
    $postResult = $conn->query("
        SELECT content, image_path 
        FROM posts 
        WHERE id = $postId
    ");
    
    if ($postResult->num_rows === 0) {
        throw new Exception('Original post not found', 404);
    }
    
    $originalPost = $postResult->fetch_assoc();
    $sharedContent = "Shared post: " . $conn->real_escape_string($originalPost['content']);
    $imagePathValue = $originalPost['image_path'] ? "'" . $conn->real_escape_string($originalPost['image_path']) . "'" : "NULL";
    
    // Create a new shared post
    $query = "INSERT INTO posts (user_id, content, image_path, original_post_id, created_at) 
              VALUES ($userId, '$sharedContent', $imagePathValue, $postId, NOW())";
    
    if ($conn->query($query)) {
        $sharedPostId = $conn->insert_id;
        
        // Get the shared post with user info
        $result = $conn->query("
            SELECT p.*, u.name as user_name, u.profile_image, 
                   0 as like_count, 0 as comment_count, 0 as is_liked
            FROM posts p
            JOIN users u ON p.user_id = u.id
            WHERE p.id = $sharedPostId
        ");
        
        $sharedPost = $result->fetch_assoc();
        
        // Update share count on original post
        $conn->query("
            UPDATE posts 
            SET share_count = COALESCE(share_count, 0) + 1 
            WHERE id = $postId
        ");
        
        sendResponse('success', [
            'post' => $sharedPost,
            'share_count' => 1
        ], 'Post shared successfully');
    } else {
        throw new Exception('Failed to share post: ' . $conn->error, 500);
    }
}

// Get comments for a post
function handleGetComments($conn) {
    $postId = isset($_GET['post_id']) ? (int)$_GET['post_id'] : 0;
    
    if (!$postId) {
        throw new Exception('Post ID is required', 400);
    }
    
    $page = isset($_GET['page']) ? max(1, (int)$_GET['page']) : 1;
    $limit = 10;
    $offset = ($page - 1) * $limit;
    
    $query = "
        SELECT c.*, u.name as user_name, u.profile_image
        FROM comments c
        JOIN users u ON c.user_id = u.id
        WHERE c.post_id = $postId
        ORDER BY c.created_at DESC
        LIMIT $limit OFFSET $offset
    ";
    
    $result = $conn->query($query);
    $comments = [];
    
    if ($result && $result->num_rows > 0) {
        while($row = $result->fetch_assoc()) {
            $comments[] = $row;
        }
    }
    
    // Get total comments count
    $countResult = $conn->query("
        SELECT COUNT(*) as total 
        FROM comments 
        WHERE post_id = $postId
    ");
    $total = $countResult->fetch_assoc()['total'];
    
    sendResponse('success', [
        'comments' => $comments,
        'pagination' => [
            'current_page' => $page,
            'per_page' => $limit,
            'total' => (int)$total,
            'total_pages' => ceil($total / $limit)
        ]
    ]);
}

// Get likes for a post
function handleGetLikes($conn) {
    $postId = isset($_GET['post_id']) ? (int)$_GET['post_id'] : 0;
    
    if (!$postId) {
        throw new Exception('Post ID is required', 400);
    }
    
    $page = isset($_GET['page']) ? max(1, (int)$_GET['page']) : 1;
    $limit = 20;
    $offset = ($page - 1) * $limit;
    
    $query = "
        SELECT u.id, u.name, u.profile_image
        FROM post_likes pl
        JOIN users u ON pl.user_id = u.id
        WHERE pl.post_id = $postId
        ORDER BY pl.created_at DESC
        LIMIT $limit OFFSET $offset
    ";
    
    $result = $conn->query($query);
    $likes = [];
    
    if ($result && $result->num_rows > 0) {
        while($row = $result->fetch_assoc()) {
            $likes[] = $row;
        }
    }
    
    // Get total likes count
    $countResult = $conn->query("
        SELECT COUNT(*) as total 
        FROM post_likes 
        WHERE post_id = $postId
    ");
    $total = $countResult->fetch_assoc()['total'];
    
    sendResponse('success', [
        'likes' => $likes,
        'total_likes' => (int)$total,
        'pagination' => [
            'current_page' => $page,
            'per_page' => $limit,
            'total' => (int)$total,
            'total_pages' => ceil($total / $limit)
        ]
    ]);
}