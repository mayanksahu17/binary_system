'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';

interface CareerProgress {
  currentLevel: {
    id: string;
    name: string;
    level: number;
    investmentThreshold: number;
    rewardAmount: number;
  } | null;
  currentLevelName: string | null;
  levelInvestment: number;
  totalBusinessVolume: number;
  completedLevels: Array<{
    levelId: string;
    levelName: string;
    completedAt: string;
    rewardAmount: number;
  }>;
  totalRewardsEarned: number;
  lastCheckedAt: string | null;
}

interface CareerLevel {
  id: string;
  name: string;
  investmentThreshold: number;
  rewardAmount: number;
  level: number;
  status: 'Active' | 'InActive';
}

export default function CareerLevelsPage() {
  const { user } = useAuth();
  const [progress, setProgress] = useState<CareerProgress | null>(null);
  const [allLevels, setAllLevels] = useState<CareerLevel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError('');
      
      // Fetch user's career progress
      const progressRes = await api.getUserCareerProgress();
      if (progressRes.data) {
        setProgress(progressRes.data.progress);
      }

      // Fetch all career levels (to show what's available)
      // Note: This is an admin-only endpoint, so it will fail for regular users
      // That's okay - we'll just show the user's progress without all levels
      try {
        const levelsRes = await api.getAllCareerLevels();
        if (levelsRes.data) {
          setAllLevels(levelsRes.data.levels || []);
        }
      } catch (err) {
        // If user doesn't have access to admin endpoint, that's okay
        // We'll just show their progress without the full list of levels
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load career progress');
    } finally {
      setLoading(false);
    }
  };

  const getProgressPercentage = (current: number, threshold: number) => {
    if (threshold === 0) return 0;
    return Math.min(100, (current / threshold) * 100);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          <p className="mt-4 text-gray-600">Loading career progress...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Career Levels</h1>
        <p className="mt-1 text-sm text-gray-500">Track your career level progress and rewards</p>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {progress && (
        <>
          {/* Current Level Card */}
          <div className="bg-white shadow rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Current Level</h2>
            {progress.currentLevel ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-2xl font-bold text-indigo-600">{progress.currentLevel.name}</h3>
                    <p className="text-sm text-gray-500">Level {progress.currentLevel.level}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-500">Reward</p>
                    <p className="text-xl font-bold text-green-600">
                      ${progress.currentLevel.rewardAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>

                {/* Progress Bar */}
                <div>
                  <div className="flex justify-between text-sm text-gray-600 mb-2">
                    <span>Progress: ${progress.levelInvestment.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    <span>Target: ${progress.currentLevel.investmentThreshold.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-4">
                    <div
                      className="bg-indigo-600 h-4 rounded-full transition-all duration-300"
                      style={{
                        width: `${getProgressPercentage(progress.levelInvestment, progress.currentLevel.investmentThreshold)}%`,
                      }}
                    ></div>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {getProgressPercentage(progress.levelInvestment, progress.currentLevel.investmentThreshold).toFixed(1)}% complete
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-500">Congratulations! You've completed all career levels! 🎉</p>
              </div>
            )}
          </div>

          {/* Statistics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-sm font-medium text-gray-500 mb-2">Total Business Volume</h3>
              <p className="text-2xl font-bold text-gray-900">
                ${progress.totalBusinessVolume.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-sm font-medium text-gray-500 mb-2">Total Rewards Earned</h3>
              <p className="text-2xl font-bold text-green-600">
                ${progress.totalRewardsEarned.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-sm font-medium text-gray-500 mb-2">Levels Completed</h3>
              <p className="text-2xl font-bold text-indigo-600">
                {progress.completedLevels.length}
              </p>
            </div>
          </div>

          {/* Completed Levels */}
          {progress.completedLevels.length > 0 && (
            <div className="bg-white shadow rounded-lg p-6 mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Completed Levels</h2>
              <div className="space-y-3">
                {progress.completedLevels
                  .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())
                  .map((completed, index) => (
                    <div
                      key={completed.levelId}
                      className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-lg"
                    >
                      <div className="flex items-center space-x-4">
                        <div className="flex-shrink-0">
                          <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center text-white font-bold">
                            ✓
                          </div>
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">{completed.levelName}</h3>
                          <p className="text-sm text-gray-500">Completed: {formatDate(completed.completedAt)}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-500">Reward Received</p>
                        <p className="text-lg font-bold text-green-600">
                          ${completed.rewardAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* All Available Levels */}
          {allLevels.length > 0 && (
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">All Career Levels</h2>
              <div className="space-y-4">
                {allLevels
                  .filter((level) => level.status === 'Active')
                  .sort((a, b) => a.level - b.level)
                  .map((level) => {
                    const isCompleted = progress.completedLevels.some(
                      (cl) => cl.levelId === level.id
                    );
                    const isCurrent = progress.currentLevel?.id === level.id;

                    return (
                      <div
                        key={level.id}
                        className={`p-4 border-2 rounded-lg ${
                          isCompleted
                            ? 'bg-green-50 border-green-300'
                            : isCurrent
                            ? 'bg-indigo-50 border-indigo-300'
                            : 'bg-gray-50 border-gray-200'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4">
                            <div
                              className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-white ${
                                isCompleted
                                  ? 'bg-green-500'
                                  : isCurrent
                                  ? 'bg-indigo-500'
                                  : 'bg-gray-400'
                              }`}
                            >
                              {isCompleted ? '✓' : level.level}
                            </div>
                            <div>
                              <h3 className="font-semibold text-gray-900">{level.name}</h3>
                              <p className="text-sm text-gray-500">
                                Investment Threshold: ${level.investmentThreshold.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-gray-500">Reward</p>
                            <p className="text-lg font-bold text-green-600">
                              ${level.rewardAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </p>
                            {isCurrent && (
                              <p className="text-xs text-indigo-600 mt-1">Current Level</p>
                            )}
                            {isCompleted && (
                              <p className="text-xs text-green-600 mt-1">Completed</p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </>
      )}

      {!progress && !loading && (
        <div className="bg-white shadow rounded-lg p-12 text-center">
          <p className="text-gray-500">No career progress found. Start investing to begin your career journey!</p>
        </div>
      )}
    </div>
  );
}

