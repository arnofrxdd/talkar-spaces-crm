#!/bin/sh
set -e

echo "🚀 [Talkar Spaces CRM] Initializing container..."
mkdir -p /app/data

echo "📦 [Talkar Spaces CRM] Deploying Prisma Database Schema..."
npx prisma db push --skip-generate

echo "🌱 [Talkar Spaces CRM] Seeding properties, centres and catalog data..."
npm run prisma:seed

echo "✨ [Talkar Spaces CRM] Initialization complete! Serving on Port ${PORT:-7578}..."
exec "$@"
