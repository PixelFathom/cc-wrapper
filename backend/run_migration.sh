#!/bin/bash
# Run alembic migration
cd /app
alembic upgrade head
echo "Migration completed!"