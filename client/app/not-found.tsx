'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function NotFound() {
  const router = useRouter();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="max-w-md w-full text-center px-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-200">
          <div className="mb-6">
            <h1 className="text-9xl font-bold text-gray-900">404</h1>
          </div>
          <h2 className="text-2xl font-bold text-black mb-4">Page Not Found</h2>
          <p className="text-black/70 mb-8">
            Sorry, the page you are looking for doesn't exist or has been moved.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => router.back()}
              className="px-6 py-3 bg-gray-200 text-black font-semibold rounded-lg hover:bg-gray-300 transition-all"
            >
              Go Back
            </button>
            <Link
              href="/"
              className="px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-all shadow-md hover:shadow-lg"
            >
              Go to Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

