import type { NextApiRequest, NextApiResponse } from 'next';
import client from '../../lib/mongodb';

type Data = {
  success: boolean;
  message: string;
  databases?: string[];
  error?: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data>
) {
  try {
    // Test connection by pinging the server
    await client.db('admin').command({ ping: 1 });
    
    // Get list of databases
    const adminDb = client.db('admin');
    const dbs = await adminDb.admin().listDatabases();
    
    res.status(200).json({
      success: true,
      message: '✅ MongoDB connected successfully!',
      databases: dbs.databases.map(db => db.name),
    });
  } catch (error) {
    console.error('MongoDB connection error:', error);
    res.status(500).json({
      success: false,
      message: '❌ MongoDB connection failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
