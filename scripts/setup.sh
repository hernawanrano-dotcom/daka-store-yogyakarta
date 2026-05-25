#!/bin/bash
# Setup script for Daka Store Yogyakarta

echo "🚀 Setting up Daka Store Yogyakarta..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
  echo "❌ Docker is not running. Please start Docker first."
  exit 1
fi

# Copy environment file
if [ ! -f .env ]; then
  cp .env.example .env
  echo "✅ Created .env file from .env.example"
fi

# Install dependencies
echo "📦 Installing dependencies..."
pnpm install

# Start Docker services
echo "🐳 Starting Docker services..."
docker-compose -f docker/docker-compose.yml up -d

# Wait for database
echo "⏳ Waiting for database..."
sleep 5

# Run migrations
echo "📊 Running database migrations..."
npx prisma migrate dev --name init

# Seed database
echo "🌱 Seeding database..."
npx prisma db seed

# Generate Prisma client
echo "🔧 Generating Prisma client..."
npx prisma generate

echo "✅ Setup complete!"
echo "📝 Backend: http://localhost:3000"
echo "📝 Gateway: http://localhost:8080"
echo "📝 Customer Web: http://localhost:3001"