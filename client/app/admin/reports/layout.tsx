'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';

const reportTabs = [
  { id: 'daily-business', name: 'Daily Business Report', href: '/admin/reports/daily-business' },
  { id: 'nowpayments', name: 'NOWPayments Report', href: '/admin/reports/nowpayments' },
  { id: 'country-business', name: 'Country Business Report', href: '/admin/reports/country-business' },
  { id: 'investments', name: 'Investments Report', href: '/admin/reports/investments' },
  { id: 'withdrawals', name: 'Withdrawal Report', href: '/admin/reports/withdrawals' },
  { id: 'binary', name: 'Binary Report', href: '/admin/reports/binary' },
  { id: 'referral', name: 'Referral Report', href: '/admin/reports/referral' },
  { id: 'roi', name: 'ROI Report', href: '/admin/reports/roi' },
];

export default function ReportsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  
  const activeTab = reportTabs.find(tab => pathname?.startsWith(tab.href))?.id || 'all-transactions';

  return (
    <div className="w-full">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Reports</h1>
        <p className="mt-1 text-sm text-gray-500">View detailed reports and analytics</p>
      </div>

      {/* Subtabs */}
      <div className="mb-6">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8 overflow-x-auto">
            {reportTabs.map((tab) => {
              const isActive = pathname === tab.href;
              return (
                <Link
                  key={tab.id}
                  href={tab.href}
                  className={`${
                    isActive
                      ? 'border-indigo-500 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
                >
                  {tab.name}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Content from child routes */}
      <div className="mt-6">
        {children}
      </div>
    </div>
  );
}

