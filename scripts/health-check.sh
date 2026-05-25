#!/bin/bash
# Health check script

echo "🏥 Health Check - Daka Store Yogyakarta"

# Check backend
if curl -s -f http://localhost:3000/health > /dev/null; then
    echo "✅ Backend: UP"
else
    echo "❌ Backend: DOWN"
fi

# Check gateway
if curl -s -f http://localhost:8080/health > /dev/null; then
    echo "✅ Gateway: UP"
else
    echo "❌ Gateway: DOWN"
fi

# Check database
if docker exec daka-postgres-prod pg_isready -U daka > /dev/null 2>&1; then
    echo "✅ PostgreSQL: UP"
else
    echo "❌ PostgreSQL: DOWN"
fi

# Check Redis
if docker exec daka-redis-prod redis-cli ping > /dev/null 2>&1; then
    echo "✅ Redis: UP"
else
    echo "❌ Redis: DOWN"
fi

echo "🏁 Health check completed"