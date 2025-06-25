// Function to load posts
async function loadPosts() {
    try {
        const response = await fetch('./backend/index/postupload.php');
        const data = await response.json();
        // const data = await response.text();
        // console.warn(data);
        
        if (data.status === 'success') {
            const feed = document.querySelector('.feed');
            const postBox = feed.querySelector('.post-box:first-child'); // Get the post input box
            
            // Clear existing posts (except the input box)
            while (feed.children.length > 1) {
                feed.removeChild(feed.lastChild);
            }
            
            // Add the posts to the feed
            data.data.forEach(post => {
                const postElement = createPostElement(post);
                feed.appendChild(postElement);
            });
        }
    } catch (error) {
        console.error('Error loading posts:', error);
    }
}

// Function to create a post element
function createPostElement(post) {
    const postBox = document.createElement('div');
    postBox.className = 'post-box post';
    
    const timeAgo = formatTimeAgo(post.created_at);
    
    postBox.innerHTML = `
        <div class="post-header">
            <img src="${post.profile_image}" alt="${post.user_name}">
            <div class="post-user">
                <h3>${post.user_name}</h3>
                <p>${timeAgo}</p>
            </div>
        </div>
        <div class="post-content">
            <p>${post.content}</p>
            ${post.image_path ? `<img src="${post.image_path}" alt="Post image" class="post-image">` : ''}
        </div>
        <div class="post-stats">
            <span>${post.like_count} reactions • ${post.comment_count} comments</span>
        </div>
        <div class="post-actions">
            <div class="post-action" onclick="likePost(${post.id})">
                <i class="far fa-thumbs-up"></i>
                <span>Like</span>
            </div>
            <div class="post-action" onclick="focusComment(${post.id})">
                <i class="far fa-comment"></i>
                <span>Comment</span>
            </div>
            <div class="post-action">
                <i class="fas fa-share"></i>
                <span>Share</span>
            </div>
        </div>
    `;
    
    return postBox;
}

// Function to format time ago
function formatTimeAgo(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);
    
    let interval = Math.floor(seconds / 31536000);
    if (interval >= 1) return `${interval}y ago`;
    
    interval = Math.floor(seconds / 2592000);
    if (interval >= 1) return `${interval}mo ago`;
    
    interval = Math.floor(seconds / 86400);
    if (interval >= 1) return `${interval}d ago`;
    
    interval = Math.floor(seconds / 3600);
    if (interval >= 1) return `${interval}h ago`;
    
    interval = Math.floor(seconds / 60);
    if (interval >= 1) return `${interval}m ago`;
    
    return 'Just now';
}

// Add this at the end of your script.js file
document.addEventListener('DOMContentLoaded', function() {
    // Make sure post box stays visible
    const postBox = document.querySelector('.post-box');
    if (postBox) {
        postBox.style.display = 'block';
        postBox.style.visibility = 'visible';
        postBox.style.opacity = '1';
    }
    
    // Check for any intervals or timeouts that might be hiding elements
    const intervalIds = window.performance.getEntries()
        .filter(entry => entry.initiatorType === 'setInterval' || entry.initiatorType === 'setTimeout')
        .map(entry => entry.name);
    
    console.log('Active intervals/timeouts:', intervalIds);
    
    // If you find any suspicious intervals, you can clear them with:
    // const maxId = setTimeout(()=>{}, 0);
    // for (let i = 0; i < maxId; i++) {
    //     clearTimeout(i);
    // }
});

// Global variables
let currentUser = { id: 1 }; // Replace with actual user ID after login

// Function to format date
function formatTimeAgo(dateString) {
    const date = new Date(dateString);
    const seconds = Math.floor((new Date() - date) / 1000);
    
    let interval = Math.floor(seconds / 31536000);
    if (interval >= 1) return `${interval}y ago`;
    
    interval = Math.floor(seconds / 2592000);
    if (interval >= 1) return `${interval}mo ago`;
    
    interval = Math.floor(seconds / 86400);
    if (interval >= 1) return `${interval}d ago`;
    
    interval = Math.floor(seconds / 3600);
    if (interval >= 1) return `${interval}h ago`;
    
    interval = Math.floor(seconds / 60);
    if (interval >= 1) return `${interval}m ago`;
    
    return 'Just now';
}

// Function to handle post submission
async function submitPost(content, image = null) {
    try {
        const formData = new FormData();
        formData.append('content', content);
        formData.append('user_id', currentUser.id);
        
        if (image) {
            formData.append('image', image);
        }
        
        const response = await fetch('./backend/index/postupload.php', {
            method: 'POST',
            body: formData,
        });

        const data = await response.json();
        
        if (data.status === 'success') {
            await loadPosts();
            const postInput = document.getElementById('postInput');
            if (postInput) postInput.value = '';
            return data;
        } else {
            throw new Error(data.message || 'Failed to create post');
        }
    } catch (error) {
        console.error('Error creating post:', error);
        alert('Error: ' + error.message);
        throw error;
    }
}

// Function to handle like/unlike action
async function toggleLike(postId) {
    try {
        const response = await fetch('./backend/index/postupload.php?action=like', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                post_id: postId,
                user_id: currentUser.id
            })
        });

        const data = await response.json();
        
        if (data.status === 'success') {
            // Update the UI
            const likeButton = document.querySelector(`.like-btn[data-post-id="${postId}"]`);
            const likeCountElement = document.querySelector(`.like-count[data-post-id="${postId}"]`);
            
            if (likeButton && likeCountElement) {
                likeButton.classList.toggle('liked', data.data.is_liked);
                likeCountElement.textContent = data.data.like_count;
            }
            
            return data;
        } else {
            throw new Error(data.message || 'Failed to toggle like');
        }
    } catch (error) {
        console.error('Error toggling like:', error);
        alert('Error: ' + error.message);
    }
}

// Function to add a comment
async function addComment(postId, content) {
    try {
        const response = await fetch('./backend/index/postupload.php?action=comment', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                post_id: postId,
                user_id: currentUser.id,
                content: content
            })
        });

        const data = await response.json();
        
        if (data.status === 'success') {
            // Refresh comments
            await loadComments(postId);
            return data;
        } else {
            throw new Error(data.message || 'Failed to add comment');
        }
    } catch (error) {
        console.error('Error adding comment:', error);
        alert('Error: ' + error.message);
    }
}

// Function to load comments for a post
async function loadComments(postId) {
    try {
        const response = await fetch(`./backend/index/postupload.php?action=get-comments&post_id=${postId}`);
        const data = await response.json();
        
        if (data.status === 'success') {
            const commentsContainer = document.querySelector(`.comments-container[data-post-id="${postId}"]`);
            if (commentsContainer) {
                // Clear existing comments
                commentsContainer.innerHTML = '';
                
                // Add new comments
                data.data.comments.forEach(comment => {
                    const commentElement = createCommentElement(comment);
                    commentsContainer.appendChild(commentElement);
                });
                
                // Update comment count
                const commentCountElement = document.querySelector(`.comment-count[data-post-id="${postId}"]`);
                if (commentCountElement) {
                    commentCountElement.textContent = data.data.pagination.total;
                }
            }
            
            return data;
        }
    } catch (error) {
        console.error('Error loading comments:', error);
    }
}

// Function to create comment element
function createCommentElement(comment) {
    const commentElement = document.createElement('div');
    commentElement.className = 'comment';
    commentElement.innerHTML = `
        <div class="comment-header">
            <img src="${comment.profile_image || 'img/default-avatar.png'}" alt="${comment.user_name}" class="comment-avatar">
            <div class="comment-user">${comment.user_name}</div>
            <div class="comment-time">${formatTimeAgo(comment.created_at)}</div>
        </div>
        <div class="comment-content">${comment.content}</div>
    `;
    return commentElement;
}

// Function to share a post
async function sharePost(postId) {
    try {
        const response = await fetch('./backend/index/postupload.php?action=share', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                post_id: postId,
                user_id: currentUser.id
            })
        });

        const data = await response.json();
        
        if (data.status === 'success') {
            // Reload posts to show the shared post
            await loadPosts();
            alert('Post shared successfully!');
            return data;
        } else {
            throw new Error(data.message || 'Failed to share post');
        }
    } catch (error) {
        console.error('Error sharing post:', error);
        alert('Error: ' + error.message);
    }
}

// Function to load posts
async function loadPosts() {
    try {
        const response = await fetch('./backend/index/postupload.php');
        const data = await response.json();
        
        if (data.status === 'success') {
            const postsContainer = document.querySelector('.posts-container');
            if (!postsContainer) {
                // Create posts container if it doesn't exist
                const feed = document.querySelector('.feed');
                const newPostsContainer = document.createElement('div');
                newPostsContainer.className = 'posts-container';
                feed.appendChild(newPostsContainer);
            }
            
            const targetContainer = document.querySelector('.posts-container') || document.querySelector('.feed');
            const postBox = document.querySelector('.post-box');
            
            // Clear only the posts, not the post box
            targetContainer.innerHTML = '';
            
            // Re-append the post box if it was removed
            if (postBox && !postBox.parentNode) {
                targetContainer.prepend(postBox);
            }
            
            // Add posts
            data.data.forEach(post => {
                const postElement = createPostElement(post);
                targetContainer.appendChild(postElement);
            });
        }
    } catch (error) {
        console.error('Error loading posts:', error);
    }
}

// Function to create post element
function createPostElement(post) {
    const postElement = document.createElement('div');
    postElement.className = 'post';
    postElement.dataset.postId = post.id;
    
    // Format the post time
    const postTime = formatTimeAgo(post.created_at);
    
    // Create post HTML
    postElement.innerHTML = `
        <div class="post-header">
            <img src="${post.profile_image || 'img/default-avatar.png'}" alt="${post.user_name}" class="post-avatar">
            <div class="post-user">
                <h3>${post.user_name}</h3>
                <p>${postTime}</p>
            </div>
        </div>
        <div class="post-content">
            <p>${post.content}</p>
            ${post.image_path ? `<img src="${post.image_path}" alt="Post image" class="post-image">` : ''}
        </div>
        <div class="post-stats">
            <span class="like-count" data-post-id="${post.id}">${post.like_count || 0}</span> likes • 
            <span class="comment-count" data-post-id="${post.id}">${post.comment_count || 0}</span> comments
        </div>
        <div class="post-actions">
            <div class="post-action like-btn ${post.is_liked ? 'liked' : ''}" data-post-id="${post.id}">
                <i class="far fa-thumbs-up"></i>
                <span>Like</span>
            </div>
            <div class="post-action comment-btn" data-post-id="${post.id}">
                <i class="far fa-comment"></i>
                <span>Comment</span>
            </div>
            <div class="post-action share-btn" data-post-id="${post.id}">
                <i class="fas fa-share"></i>
                <span>Share</span>
            </div>
        </div>
        <div class="comments-container" data-post-id="${post.id}">
            <!-- Comments will be loaded here -->
        </div>
        <div class="add-comment" data-post-id="${post.id}">
            <input type="text" class="comment-input" placeholder="Write a comment...">
            <button class="post-comment-btn">Post</button>
        </div>
    `;
    
    return postElement;
}

// Event delegation for post actions
document.addEventListener('click', async (e) => {
    // Like button
    if (e.target.closest('.like-btn')) {
        const likeBtn = e.target.closest('.like-btn');
        const postId = likeBtn.dataset.postId;
        await toggleLike(postId);
    }
    
    // Comment button
    else if (e.target.closest('.comment-btn')) {
        const commentBtn = e.target.closest('.comment-btn');
        const postId = commentBtn.dataset.postId;
        const commentsContainer = document.querySelector(`.comments-container[data-post-id="${postId}"]`);
        
        if (commentsContainer) {
            commentsContainer.style.display = commentsContainer.style.display === 'none' ? 'block' : 'none';
            
            // Load comments if not already loaded
            if (commentsContainer.children.length === 0) {
                await loadComments(postId);
            }
        }
    }
    
    // Share button
    else if (e.target.closest('.share-btn')) {
        const shareBtn = e.target.closest('.share-btn');
        const postId = shareBtn.dataset.postId;
        if (confirm('Do you want to share this post?')) {
            await sharePost(postId);
        }
    }
    
    // Post comment button
    else if (e.target.closest('.post-comment-btn')) {
        const postCommentBtn = e.target.closest('.post-comment-btn');
        const addCommentDiv = postCommentBtn.closest('.add-comment');
        const postId = addCommentDiv.dataset.postId;
        const commentInput = addCommentDiv.querySelector('.comment-input');
        const commentContent = commentInput.value.trim();
        
        if (commentContent) {
            await addComment(postId, commentContent);
            commentInput.value = '';
        }
    }
});

// Handle Enter key in comment input
document.addEventListener('keypress', async (e) => {
    if (e.target.classList.contains('comment-input') && e.key === 'Enter') {
        const commentInput = e.target;
        const addCommentDiv = commentInput.closest('.add-comment');
        const postId = addCommentDiv.dataset.postId;
        const commentContent = commentInput.value.trim();
        
        if (commentContent) {
            await addComment(postId, commentContent);
            commentInput.value = '';
        }
    }
});

// Initialize the page
document.addEventListener('DOMContentLoaded', () => {
    loadPosts();
    
    // Handle post form submission
    const postForm = document.getElementById('postForm');
    if (postForm) {
        postForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const content = postForm.querySelector('textarea').value.trim();
            const imageInput = postForm.querySelector('input[type="file"]');
            const image = imageInput.files.length > 0 ? imageInput.files[0] : null;
            
            if (content || image) {
                try {
                    await submitPost(content, image);
                    postForm.reset();
                    // Close modal if open
                    const modal = document.getElementById('postModal');
                    if (modal) {
                        modal.style.display = 'none';
                    }
                } catch (error) {
                    console.error('Error submitting post:', error);
                }
            }
        });
    }
});

// Function to handle post submission
async function submitPost(content, image = null) {
    try {
        const formData = new FormData();
        formData.append('content', content);
        formData.append('user_id', 1); // Temporary hardcoded user ID for testing
        
        if (image) {
            formData.append('image', image);
        }
        
        console.log('Submitting post with data:', {
            content: content,
            hasImage: !!image
        });
        
        const response = await fetch('./backend/index/postupload.php', {
            method: 'POST',
            body: formData,
            // Don't set Content-Type header - let the browser set it with the boundary
        });
        
        console.log('Response status:', response.status);
        const responseText = await response.text();
        console.log('Raw response:', responseText);
        
        let data;
        try {
            data = JSON.parse(responseText);
        } catch (e) {
            console.error('Failed to parse response as JSON:', e);
            throw new Error('Invalid response from server');
        }
        
        console.log('Parsed response:', data);
        
        if (data.status === 'success') {
            // Reload posts
            await loadPosts();
            // Clear the input
            const postInput = document.getElementById('postInput');
            if (postInput) postInput.value = '';
            
            return data;
        } else {
            throw new Error(data.message || 'Failed to create post');
        }
    } catch (error) {
        console.error('Error in submitPost:', error);
        alert('Error: ' + error.message);
        throw error;
    }
}

// Add event listener for post submission
// Handle modal form submission
document.addEventListener('DOMContentLoaded', function() {
    const postForm = document.getElementById('postForm');
    if (postForm) {
        postForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const formData = new FormData(this);
            
            try {
                console.log('Form data:', {
                    content: formData.get('content'),
                    user_id: formData.get('user_id'),
                    hasImage: !!formData.get('image')
                });

                const response = await fetch('./backend/index/postupload.php', {
                    method: 'POST',
                    body: formData
                    // Don't set Content-Type header - let the browser set it with the boundary
                });

                console.log('Response status:', response.status);
                const responseText = await response.text();
                console.log('Raw response:', responseText);

                let data;
                try {
                    data = JSON.parse(responseText);
                } catch (e) {
                    console.error('Failed to parse response as JSON:', e);
                    throw new Error('Invalid response from server');
                }

                console.log('Parsed response:', data);

                if (data.status === 'success') {
                    // Reload posts
                    await loadPosts();
                    // Close modal and reset form
                    closeModal();
                    this.reset();
                } else {
                    throw new Error(data.message || 'Failed to create post');
                }
            } catch (error) {
                console.error('Error creating post:', error);
                alert('Error: ' + error.message);
            }
        });
    }
});

// Add event listener for post submission
document.getElementById('postInput').addEventListener('keypress', async function(e) {
    if (e.key === 'Enter' && this.value.trim() !== '') {
        await submitPost(this.value);
    }
});

// Load posts when the page loads
// document.addEventListener('DOMContentLoaded', loadPosts);

// Initialize the page
document.addEventListener('DOMContentLoaded', () => {
    // Make sure post box stays visible
    const postBox = document.querySelector('.post-box');
    if (postBox) {
        postBox.style.display = 'block';
    }
    
    // Load posts
    loadPosts();
    
    // Rest of your initialization code...
});

// main left 
document.addEventListener('DOMContentLoaded', function() {
    const sectionHeaders = document.querySelectorAll('.section-header');
    
    sectionHeaders.forEach(header => {
        header.addEventListener('click', function() {
            this.parentElement.classList.toggle('active');
        });
    });
});