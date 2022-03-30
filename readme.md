# Discord Email Tunnel

Synchronous text-based communication isn't very efficient, but Discord is a convenient communication platform. This project acts as a proxy/tunnel between Discord messages and emails, allowing you to use your email to asynchronously communicate with others on Discord.

## Google Cloud Scopes

https://www.googleapis.com/auth/pubsub, https://www.googleapis.com/auth/cloud-platform, https://mail.google.com, https://www.googleapis.com/auth/cloud-platform

## Setup

Give the email `gmail-api-push@system.gserviceaccount.com` access to publishing to your Pub/Sub topic.
