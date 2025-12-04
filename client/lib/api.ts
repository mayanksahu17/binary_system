// API utility functions for making requests to the backend

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api/v1';

export interface ApiResponse<T = any> {
  status: 'success' | 'error';
  message?: string;
  data?: T;
}

class ApiClient {
  private baseURL: string;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseURL}${endpoint}`;
    
    const config: RequestInit = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      credentials: 'include', // Include cookies
    };

    // Add auth token if available
    if (typeof window !== 'undefined') {
      const isAdminRoute = endpoint.startsWith('/admin');
      
      // Check if we're in an impersonation context (new tab with user session)
      const isImpersonating = sessionStorage.getItem('isImpersonating') === 'true';
      
      let token: string | null = null;
      
      if (isAdminRoute) {
        // For admin routes: use adminToken, or token if CROWN-000000
        // Don't use impersonated token for admin routes
        if (!isImpersonating) {
          token = localStorage.getItem('adminToken') || localStorage.getItem('token');
        }
      } else {
        // For user routes: prioritize impersonated token if in impersonation context
        if (isImpersonating) {
          token = sessionStorage.getItem('token') || localStorage.getItem('impersonatedToken');
        } else {
          token = localStorage.getItem('token') || localStorage.getItem('adminToken');
        }
      }
      
      if (token) {
        config.headers = {
          ...config.headers,
          Authorization: `Bearer ${token}`,
        };
      }
    }

    try {
      const response = await fetch(url, config);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Request failed');
      }

      return data;
    } catch (error) {
      throw error;
    }
  }

  // User Auth
  async userSignup(data: {
    name: string;
    email?: string;
    phone?: string;
    password: string;
    referrerId?: string;
    position?: 'left' | 'right';
  }) {
    return this.request<{ user: any; token: string }>('/auth/signup', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async userLogin(data: { email?: string; phone?: string; userId?: string; password: string }) {
    const response = await this.request<{ user: any; token: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    
    if (response.data?.token && typeof window !== 'undefined') {
      localStorage.setItem('token', response.data.token);
    }
    
    return response;
  }

  async userLogout() {
    const response = await this.request('/auth/logout', {
      method: 'POST',
    });
    
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token');
    }
    
    return response;
  }

  async getUserProfile() {
    return this.request<{ user: any }>('/auth/me', {
      method: 'GET',
    });
  }

  // Admin Auth
  async adminSignup(data: {
    name: string;
    email: string;
    password: string;
    phone?: string;
    role?: number;
  }) {
    return this.request<{ admin: any; token: string }>('/admin/signup', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async adminLogin(data: { email: string; password: string }) {
    const response = await this.request<{ admin: any; token: string }>('/admin/login', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    
    if (response.data?.token && typeof window !== 'undefined') {
      localStorage.setItem('adminToken', response.data.token);
    }
    
    return response;
  }

  async adminLogout() {
    const response = await this.request('/admin/logout', {
      method: 'POST',
    });
    
    if (typeof window !== 'undefined') {
      localStorage.removeItem('adminToken');
    }
    
    return response;
  }

  async getAdminProfile() {
    return this.request<{ admin: any }>('/admin/me', {
      method: 'GET',
    });
  }

  // Package CRUD (Admin only)
  async getPackages(params?: { status?: string; page?: number; limit?: number }) {
    const queryParams = new URLSearchParams();
    if (params?.status) queryParams.append('status', params.status);
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    
    const query = queryParams.toString();
    return this.request<{ packages: any[]; pagination: any }>(
      `/admin/packages${query ? `?${query}` : ''}`,
      { method: 'GET' }
    );
  }

  async getPackageById(id: string) {
    return this.request<{ package: any }>(`/admin/packages/${id}`, {
      method: 'GET',
    });
  }

  async createPackage(data: any) {
    return this.request<{ package: any }>('/admin/packages', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updatePackage(id: string, data: any) {
    return this.request<{ package: any }>(`/admin/packages/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deletePackage(id: string) {
    return this.request(`/admin/packages/${id}`, {
      method: 'DELETE',
    });
  }

  // User endpoints
  async getUserWallets() {
    return this.request<{ wallets: any[] }>('/user/wallets', {
      method: 'GET',
    });
  }

  async getUserPackages() {
    return this.request<{ packages: any[] }>('/user/packages', {
      method: 'GET',
    });
  }

  async createInvestment(data: { packageId: string; amount: number; currency?: string }) {
    return this.request<{ investment: any; payment: any; wallets: any[]; binaryTree: any }>('/user/invest', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getUserInvestments() {
    return this.request<{ investments: any[] }>('/user/investments', {
      method: 'GET',
    });
  }

  async getUserBinaryTree() {
    return this.request<{ binaryTree: any }>('/user/binary-tree', {
      method: 'GET',
    });
  }

  async getUserTransactions(params?: { walletType?: string; type?: string; page?: number; limit?: number }) {
    const queryParams = new URLSearchParams();
    if (params?.walletType) queryParams.append('walletType', params.walletType);
    if (params?.type) queryParams.append('type', params.type);
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    
    const query = queryParams.toString();
    return this.request<{ transactions: any[]; pagination: any }>(
      `/user/transactions${query ? `?${query}` : ''}`,
      { method: 'GET' }
    );
  }

  async getMyTree() {
    return this.request<{ tree: any[]; rootUserId: string; rootName: string }>('/tree/my-tree', {
      method: 'GET',
    });
  }

  async createWithdrawal(data: { amount: number; walletType: string; method?: string; cryptoType?: string; merchant?: string }) {
    return this.request<{ withdrawal: any }>('/user/withdraw', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getUserWithdrawals() {
    return this.request<{ withdrawals: any[] }>('/user/withdrawals', {
      method: 'GET',
    });
  }

  async createVoucher(data: { amount: number; fromWalletType?: string; expiryDays?: number }) {
    return this.request<{ voucher: any }>('/user/vouchers/create', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getUserVouchers(params?: { status?: string }) {
    const queryParams = new URLSearchParams();
    if (params?.status) queryParams.append('status', params.status);
    const query = queryParams.toString();
    return this.request<{ vouchers: any[] }>(
      `/user/vouchers${query ? `?${query}` : ''}`,
      { method: 'GET' }
    );
  }

  async updateWalletAddress(data: { walletAddress?: string; bankAccount?: any }) {
    return this.request<{ user: any }>('/user/wallet-address', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async getReferralLinks() {
    return this.request<{ leftReferralLink: string; rightReferralLink: string; userId: string }>('/user/referral-links', {
      method: 'GET',
    });
  }

  async getUserReferralLinks() {
    return this.request<{ leftLink: string; rightLink: string; userId: string }>('/user/referral-links', {
      method: 'GET',
    });
  }

  async exchangeWalletFunds(data: { fromWalletType: string; toWalletType: string; amount: number; exchangeRate?: number }) {
    return this.request<{
      exchangeId: string;
      fromWallet: { type: string; balanceBefore: number; balanceAfter: number; amountDebited: number };
      toWallet: { type: string; balanceBefore: number; balanceAfter: number; amountCredited: number };
      exchangeRate: number;
    }>('/user/wallet-exchange', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getUserReports() {
    return this.request<{ roi: any[]; binary: any[]; referral: any[]; withdrawals: any[] }>('/user/reports', {
      method: 'GET',
    });
  }

  // Admin User Management
  async getAdminUsers(params?: { page?: number; limit?: number; search?: string }) {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.search) queryParams.append('search', params.search);
    const query = queryParams.toString();
    return this.request<{ users: any[]; pagination: any }>(
      `/admin/users${query ? `?${query}` : ''}`,
      { method: 'GET' }
    );
  }

  async impersonateUser(userId: string) {
    const response = await this.request<{ user: any; token: string }>(`/admin/impersonate/${userId}`, {
      method: 'POST',
    });
    
    // Don't store token here - it will be handled by the impersonate page in the new tab
    // This allows the admin panel to maintain its own session
    
    return response;
  }

  async deleteUser(userId: string) {
    return this.request<{ deletedUserId: string; deletedUserName: string }>(`/admin/users/${userId}`, {
      method: 'DELETE',
    });
  }

  async flushAllInvestments() {
    return this.request<{
      investmentsDeleted: number;
      transactionsDeleted: number;
      walletsReset: string;
      binaryTreesReset: string;
    }>('/admin/investments/flush-all', {
      method: 'DELETE',
    });
  }

  async getAdminStatistics() {
    return this.request<{
      totalUsers: number;
      verifiedUsers: number;
      unverifiedUsers: number;
      totalDeposits: string;
      totalWithdrawals: string;
      totalInvestment: string;
      totalVoucherInvestment: string;
      totalFreeInvestment: string;
      totalPowerlegInvestment: string;
      totalROI: string;
      totalReferralBonus: string;
      totalBinaryBonus: string;
    }>('/admin/statistics', {
      method: 'GET',
    });
  }

  async getAdminWithdrawals(params?: { page?: number; limit?: number; status?: string }) {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.status) queryParams.append('status', params.status);
    const query = queryParams.toString();
    return this.request<{ withdrawals: any[]; pagination: any }>(
      `/admin/withdrawals${query ? `?${query}` : ''}`,
      { method: 'GET' }
    );
  }

  async approveWithdrawal(withdrawalId: string) {
    return this.request<{ withdrawal: any }>(`/admin/withdrawals/${withdrawalId}/approve`, {
      method: 'POST',
    });
  }

  async rejectWithdrawal(withdrawalId: string, reason?: string) {
    return this.request<{ withdrawal: any }>(`/admin/withdrawals/${withdrawalId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  async triggerDailyCalculations(data?: { includeROI?: boolean; includeBinary?: boolean; includeReferral?: boolean }) {
    return this.request<{ roi: any; binary: any; referral: any }>('/admin/trigger-daily-calculations', {
      method: 'POST',
      body: JSON.stringify(data || {}),
    });
  }
}

export const api = new ApiClient(API_BASE_URL);

