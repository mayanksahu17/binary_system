// API utility functions for making requests to the backend
//13.48.131.244
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
    country?: string;
    referrerId?: string;
    position?: 'left' | 'right';
  }) {
    return this.request<{ user: any; token: string }>('/auth/signup', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateProfile(data: {
    name?: string;
    email?: string;
    phone?: string;
    country?: string;
    walletAddress?: string;
    bankAccount?: {
      accountNumber?: string;
      bankName?: string;
      ifscCode?: string;
      accountHolderName?: string;
    };
  }) {
    return this.request<{ user: any }>('/user/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async validateReferrer(referrerId: string) {
    return this.request<{ valid: boolean; message: string; referrer?: { userId: string; name: string } }>(`/auth/validate-referrer/${encodeURIComponent(referrerId)}`, {
      method: 'GET',
    });
  }

  async verifyLoginToken(token: string) {
    const response = await this.request<{ user: any; token: string }>('/auth/verify-login-token', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
    
    if (response.data?.token && typeof window !== 'undefined') {
      localStorage.setItem('token', response.data.token);
    }
    
    return response;
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

  async forgotPassword(email: string) {
    return this.request<{ message: string }>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  async resetPassword(token: string, password: string) {
    return this.request<{ message: string }>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
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

  async createInvestment(data: { packageId: string; amount: number; currency?: string; paymentId?: string; voucherId?: string }) {
    return this.request<{ investment: any; payment: any; wallets: any[]; binaryTree: any }>('/user/invest', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // NOWPayments integration
  async createPayment(data: { packageId: string; amount: number; currency?: string; voucherId?: string }) {
    return this.request<{ payment?: any; orderId?: string; voucher?: any; remainingAmount?: number; investment?: any }>('/payment/create', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getPaymentStatus(paymentId: string) {
    return this.request<{ payment: any }>(`/payment/status/${paymentId}`, {
      method: 'GET',
    });
  }

  async getPaymentByOrderId(orderId: string) {
    return this.request<{ payment: any }>(`/payment/order/${orderId}`, {
      method: 'GET',
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

  async createVoucher(data: { amount: number; fromWalletType?: string; currency?: string }) {
    return this.request<{ voucher: any; payment?: any; orderId?: string }>('/user/vouchers/create', {
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

  async changeUserPassword(userId: string, newPassword: string) {
    return this.request<{ userId: string; name: string; email: string }>(`/admin/users/${userId}/password`, {
      method: 'PUT',
      body: JSON.stringify({ newPassword }),
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

  async getAdminReports() {
    return this.request<{
      roi: any[];
      binary: any[];
      referral: any[];
      investment: any[];
      withdrawals: any[];
    }>('/admin/reports', {
      method: 'GET',
    });
  }

  async getDailyBusinessReport(date?: string) {
    const params = date ? `?date=${date}` : '';
    return this.request<any>(`/admin/reports/daily-business${params}`, {
      method: 'GET',
    });
  }

  async getNOWPaymentsReport() {
    return this.request<any>('/admin/reports/nowpayments', {
      method: 'GET',
    });
  }

  async getCountryBusinessReport() {
    return this.request<any>('/admin/reports/country-business', {
      method: 'GET',
    });
  }

  async getInvestmentsReport() {
    return this.request<any>('/admin/reports/investments', {
      method: 'GET',
    });
  }

  async getWithdrawalsReport() {
    return this.request<any>('/admin/reports/withdrawals', {
      method: 'GET',
    });
  }

  async getBinaryReport() {
    return this.request<any>('/admin/reports/binary', {
      method: 'GET',
    });
  }

  async getReferralReport() {
    return this.request<any>('/admin/reports/referral', {
      method: 'GET',
    });
  }

  async getROIReport() {
    return this.request<any>('/admin/reports/roi', {
      method: 'GET',
    });
  }

  async adminCreateInvestment(data: { userId: string; packageId: string; amount: number; type?: string }) {
    return this.request<{ investment: any }>('/admin/investments/create', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getAllTickets(params?: { page?: number; limit?: number; status?: string }) {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.status) queryParams.append('status', params.status);
    const query = queryParams.toString();
    return this.request<{ tickets: any[]; pagination: any }>(
      `/admin/tickets${query ? `?${query}` : ''}`,
      { method: 'GET' }
    );
  }

  async updateTicket(ticketId: string, data: { status?: string; reply?: string }) {
    return this.request<{ ticket: any }>(`/admin/tickets/${ticketId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async createTicket(data: { department: string; service?: string; subject: string; description?: string; document?: string }) {
    return this.request<{ ticket: any }>('/user/tickets', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getUserTickets() {
    return this.request<{ tickets: any[] }>('/user/tickets', {
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

  // Settings management
  async getNOWPaymentsStatus() {
    return this.request<{ enabled: boolean }>('/admin/settings/nowpayments', {
      method: 'GET',
    });
  }

  async updateNOWPaymentsStatus(enabled: boolean) {
    return this.request<{ enabled: boolean }>('/admin/settings/nowpayments', {
      method: 'PUT',
      body: JSON.stringify({ enabled }),
    });
  }

  // Career Level Management (Admin)
  async getAllCareerLevels() {
    return this.request<{ levels: any[] }>('/admin/career-levels', {
      method: 'GET',
    });
  }

  async getCareerLevelById(id: string) {
    return this.request<{ level: any }>(`/admin/career-levels/${id}`, {
      method: 'GET',
    });
  }

  async createCareerLevel(data: {
    name: string;
    investmentThreshold: number;
    rewardAmount: number;
    level: number;
    status?: 'Active' | 'InActive';
    description?: string;
  }) {
    return this.request<{ level: any }>('/admin/career-levels', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateCareerLevel(id: string, data: {
    name?: string;
    investmentThreshold?: number;
    rewardAmount?: number;
    level?: number;
    status?: 'Active' | 'InActive';
    description?: string;
  }) {
    return this.request<{ level: any }>(`/admin/career-levels/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteCareerLevel(id: string) {
    return this.request(`/admin/career-levels/${id}`, {
      method: 'DELETE',
    });
  }

  // Career Progress (Admin)
  async getAllUsersCareerProgress(page?: number, limit?: number) {
    const params = new URLSearchParams();
    if (page) params.append('page', page.toString());
    if (limit) params.append('limit', limit.toString());
    return this.request<{ progress: any[]; pagination: any }>(`/admin/career-progress?${params.toString()}`, {
      method: 'GET',
    });
  }

  async getUserCareerProgressAdmin(userId: string) {
    return this.request<{ progress: any }>(`/admin/career-progress/${userId}`, {
      method: 'GET',
    });
  }

  // Career Progress (User)
  async getUserCareerProgress() {
    return this.request<{ progress: any }>('/user/career-progress', {
      method: 'GET',
    });
  }
}

export const api = new ApiClient(API_BASE_URL);

