#!/bin/bash

# Generate self-signed SSL certificates for development
openssl req -x509 -newkey rsa:4096 -keyout /tmp/key.pem -out /tmp/cert.pem -days 365 -nodes -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost"

echo "SSL certificates generated at /tmp/key.pem and /tmp/cert.pem"