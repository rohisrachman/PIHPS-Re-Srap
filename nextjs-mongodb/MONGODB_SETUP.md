# MongoDB Atlas Setup for Next.js

## ✅ Configuration Complete

### Environment Variables
Created `.env.local` with your MongoDB Atlas connection string:

```bash
MONGODB_URI=mongodb+srv://Vercel-Admin-atlas-citron-cushion:****@atlas-citron-cushion.4u1fsog.mongodb.net/?retryWrites=true&w=majority
```

### Files Updated
- `lib/mongodb.ts` - MongoDB client with ServerApi v1 for Atlas compatibility
- `pages/api/mongodb-test.ts` - API route to test connection
- `.env.local` - Environment variables (git-ignored)

## 🚀 Quick Start

### 1. Run Development Server
```bash
npm run dev
```

### 2. Test MongoDB Connection
Open browser to:
```
http://localhost:3000/api/mongodb-test
```

Expected response:
```json
{
  "success": true,
  "message": "✅ MongoDB connected successfully!",
  "databases": ["database1", "database2", ...]
}
```

## 📁 Project Structure

```
my-mongodb-app/
├── lib/
│   └── mongodb.ts          # MongoDB client configuration
├── pages/
│   ├── api/
│   │   └── mongodb-test.ts # Test API route
│   └── index.tsx           # Home page
├── .env.local              # Environment variables (git-ignored)
└── package.json            # Dependencies (mongodb ^6.19.0)
```

## 🔒 Security

- `.env.local` is added to `.gitignore` and won't be pushed to GitHub
- For production on Vercel, add `MONGODB_URI` as environment variable in Vercel Dashboard

## 📚 Usage Example

### Using in API Routes
```typescript
import client from '../../lib/mongodb';

export default async function handler(req, res) {
  const db = client.db('my-database');
  const collection = db.collection('my-collection');
  
  const data = await collection.find({}).toArray();
  res.json(data);
}
```

### Using in App Router (app/api)
```typescript
import client from '@/lib/mongodb';

export async function GET() {
  const db = client.db('my-database');
  const data = await db.collection('items').find({}).toArray();
  
  return Response.json({ data });
}
```

## 🔧 Troubleshooting

### SSL Certificate Error
The MongoDB driver automatically handles SSL for Atlas connections.

### Connection Timeout
- Check IP whitelist in MongoDB Atlas (Network Access)
- Verify connection string is correct

### Bad Auth Error
- Ensure database user exists in MongoDB Atlas
- Check username and password are correct
