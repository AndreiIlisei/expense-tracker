export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import cloudinary from '@/lib/cloudinary';
import db, { schema } from '@/database/drizzle';
import { Readable } from 'node:stream';

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get('file') as File | null;
    if (!file)
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const uploadResult = await new Promise<{
      secure_url: string;
      public_id: string;
    }>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: process.env.CLOUDINARY_FOLDER || 'expense-tracker/receipts',
          resource_type: 'image',
        },
        (err, res) => {
          if (err || !res) return reject(err);
          resolve({ secure_url: res.secure_url!, public_id: res.public_id! });
        }
      );
      Readable.from(buffer).pipe(stream);
    });

    const [inserted] = await db
      .insert(schema.receipts)
      .values({
        storageUrl: uploadResult.secure_url,
        status: 'uploaded',
      })
      .returning();

    return NextResponse.json({ receipt: inserted });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json(
      { error: e?.message || 'Upload failed' },
      { status: 500 }
    );
  }
}
