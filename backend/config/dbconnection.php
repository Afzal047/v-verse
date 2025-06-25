<?php
// backend/config/db_connection.php

function getDBConnection() {
    $host = 'localhost';
    $dbname = 'v_verse';
    $username = 'root';
    $password = '';

    // Create connection
    $conn = new mysqli($host, $username, $password, $dbname);

    // Check connection
    if ($conn->connect_error) {
        die("Connection failed: " . $conn->connect_error);
    }

    return $conn;
}