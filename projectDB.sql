-- Create a new database
CREATE DATABASE twitter_feed;

-- Use the database
USE twitter_feed;

-- Create the tweets table
CREATE TABLE tweets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(100),
    content TEXT,
    time DATETIME DEFAULT CURRENT_TIMESTAMP
);
SELECT * FROM tweets;

ALTER TABLE tweets ADD COLUMN likes INT DEFAULT 0;

CREATE TABLE comments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tweet_id INT,
    username VARCHAR(100),
    comment TEXT,
    time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tweet_id) REFERENCES tweets(id) ON DELETE CASCADE
);

SELECT * FROM comments;

CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

SELECT * FROM users;


DROP TABLE follows;
-- CREATE TABLE follows (
--     follower_id INT,
--     following_id INT,
--     PRIMARY KEY (follower_id, following_id),
--     FOREIGN KEY (follower_id) REFERENCES users(id),
--     FOREIGN KEY (following_id) REFERENCES users(id)
-- );

-- SELECT * FROM follows;

CREATE TABLE messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sender_id INT NOT NULL,
  receiver_id INT NOT NULL,
  message TEXT NOT NULL,
  time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sender_id) REFERENCES users(id),
  FOREIGN KEY (receiver_id) REFERENCES users(id)
);

SELECT * FROM messages;

DESCRIBE messages;

SHOW TABLES;
DESCRIBE messages;



