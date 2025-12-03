'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

function SignupContent() {
  const searchParams = useSearchParams();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    referrerId: '',
    position: 'left' as 'left' | 'right',
  });
  const [isAdmin, setIsAdmin] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [referrerFromUrl, setReferrerFromUrl] = useState(false);
  const { signup } = useAuth();
  const router = useRouter();

  // Read referral parameters from URL
  useEffect(() => {
    const referrer = searchParams.get('referrer');
    const position = searchParams.get('position');
    
    if (referrer) {
      setFormData(prev => ({
        ...prev,
        referrerId: referrer,
        position: (position === 'right' ? 'right' : 'left') as 'left' | 'right',
      }));
      setReferrerFromUrl(true);
    }
  }, [searchParams]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    if (!isAdmin && !formData.email && !formData.phone) {
      setError('Either email or phone number is required');
      return;
    }

    setLoading(true);

    try {
      const signupData: any = {
        name: formData.name,
        password: formData.password,
      };

      if (isAdmin) {
        signupData.email = formData.email;
        if (formData.phone) signupData.phone = formData.phone;
      } else {
        if (formData.email) signupData.email = formData.email;
        if (formData.phone) signupData.phone = formData.phone;
        if (formData.referrerId) signupData.referrerId = formData.referrerId;
        if (formData.position) signupData.position = formData.position;
      }

      await signup(signupData, isAdmin);
      router.push(isAdmin ? '/admin/packages' : '/dashboard');
    } catch (err: any) {
      setError(err.message || 'Signup failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Create your account
          </h2>
          {referrerFromUrl && (
            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-md">
              <p className="text-sm text-green-800 text-center">
                ✓ You're signing up with a referral link! Referrer and position have been automatically set.
              </p>
            </div>
          )}
          <p className="mt-2 text-center text-sm text-gray-600">
            Or{' '}
            <a href="/login" className="font-medium text-indigo-600 hover:text-indigo-500">
              sign in to existing account
            </a>
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-50 border border-red-400 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          <div className="rounded-md shadow-sm space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                Full Name
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                value={formData.name}
                onChange={handleChange}
              />
            </div>

            {isAdmin ? (
              <>
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                    Email
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    value={formData.email}
                    onChange={handleChange}
                  />
                </div>
                <div>
                  <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
                    Phone (Optional)
                  </label>
                  <input
                    id="phone"
                    name="phone"
                    type="tel"
                    className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    value={formData.phone}
                    onChange={handleChange}
                  />
                </div>
              </>
            ) : (
              <>
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                    Email (Optional)
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    value={formData.email}
                    onChange={handleChange}
                  />
                </div>
                <div>
                  <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
                    Phone (Optional)
                  </label>
                  <input
                    id="phone"
                    name="phone"
                    type="tel"
                    className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    value={formData.phone}
                    onChange={handleChange}
                  />
                </div>
                <div>
                  <label htmlFor="referrerId" className="block text-sm font-medium text-gray-700">
                    Referrer ID {referrerFromUrl && <span className="text-green-600">(From Link)</span>}
                  </label>
                  <input
                    id="referrerId"
                    name="referrerId"
                    type="text"
                    disabled={referrerFromUrl}
                    className={`mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm ${
                      referrerFromUrl ? 'bg-green-50 cursor-not-allowed' : ''
                    }`}
                    placeholder="CROWN-XXXXXX"
                    value={formData.referrerId}
                    onChange={handleChange}
                  />
                  {referrerFromUrl && (
                    <p className="mt-1 text-xs text-green-600">
                      Referrer ID was automatically filled from your referral link
                    </p>
                  )}
                </div>
                <div>
                  <label htmlFor="position" className="block text-sm font-medium text-gray-700">
                    Position {referrerFromUrl && <span className="text-green-600">(From Link)</span>}
                  </label>
                  <select
                    id="position"
                    name="position"
                    disabled={referrerFromUrl}
                    className={`mt-1 block w-full px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm ${
                      referrerFromUrl ? 'bg-green-50 cursor-not-allowed' : ''
                    }`}
                    value={formData.position}
                    onChange={handleChange}
                  >
                    <option value="left">Left</option>
                    <option value="right">Right</option>
                  </select>
                  {referrerFromUrl && (
                    <p className="mt-1 text-xs text-green-600">
                      Position was automatically set from your referral link
                    </p>
                  )}
                </div>
              </>
            )}

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                minLength={8}
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                value={formData.password}
                onChange={handleChange}
              />
            </div>
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                required
                minLength={8}
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                value={formData.confirmPassword}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="flex items-center">
            <input
              id="is-admin"
              name="is-admin"
              type="checkbox"
              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
              checked={isAdmin}
              onChange={(e) => setIsAdmin(e.target.checked)}
            />
            <label htmlFor="is-admin" className="ml-2 block text-sm text-gray-900">
              Sign up as Admin
            </label>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {loading ? 'Creating account...' : 'Create account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            <p className="mt-4 text-gray-600">Loading...</p>
          </div>
        </div>
      }
    >
      <SignupContent />
    </Suspense>
  );
}

