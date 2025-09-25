import React, { useState, useEffect } from 'react';
import { apiGet } from '../../api';
import ReportCharts, { ChartGrid, SummaryCards } from './ReportCharts';

const BusinessReports = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [reportData, setReportData] = useState({
    overview: null,
    agents: [],
    drivers: [],
    investors: [],
    countries: [],
    countryDrivers: []
  });

  useEffect(() => {
    loadReportData();
  }, [dateRange]);

  const loadReportData = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError(null);
    
    try {
      const [overview, agents, drivers, investors, countries] = await Promise.all([
        fetchOverviewReport(),
        fetchAgentReports(),
        fetchDriverReports(),
        fetchInvestorReports(),
        fetchCountryReports()
      ]);

      setReportData({
        overview,
        agents,
        drivers,
        investors,
        countries,
        countryDrivers: await fetchCountryDriverReports()
      });
      
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error loading report data:', error);
      setError(error.message || 'Failed to load report data');
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  const refreshData = () => {
    loadReportData(false);
  };

  const exportReport = (format = 'json') => {
    const dataToExport = {
      dateRange,
      reportData,
      generatedAt: new Date().toISOString(),
      activeTab
    };

    if (format === 'json') {
      const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `business-report-${activeTab}-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  const fetchOverviewReport = async () => {
    try {
      const response = await apiGet(`/reports/overview?period=${dateRange.start}_${dateRange.end}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching overview:', error);
      return null;
    }
  };

  const fetchAgentReports = async () => {
    try {
      const response = await apiGet(`/reports/agents?period=${dateRange.start}_${dateRange.end}&limit=100`);
      return response.data;
    } catch (error) {
      console.error('Error fetching agent reports:', error);
      return [];
    }
  };

  const fetchDriverReports = async () => {
    try {
      const response = await apiGet(`/reports/drivers?period=${dateRange.start}_${dateRange.end}&limit=100`);
      return response.data;
    } catch (error) {
      console.error('Error fetching driver reports:', error);
      return [];
    }
  };

  const fetchInvestorReports = async () => {
    try {
      const response = await apiGet(`/reports/investors?period=${dateRange.start}_${dateRange.end}&limit=100`);
      return response.data;
    } catch (error) {
      console.error('Error fetching investor reports:', error);
      return [];
    }
  };

  const fetchCountryReports = async () => {
    try {
      const response = await apiGet(`/reports/countries?period=${dateRange.start}_${dateRange.end}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching country reports:', error);
      return [];
    }
  };

  const fetchCountryDriverReports = async () => {
    try {
      const response = await apiGet(`/reports/country-drivers?period=${dateRange.start}_${dateRange.end}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching country driver reports:', error);
      return [];
    }
  };

  const formatCurrency = (amount, currency = 'SAR') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(amount);
  };

  const formatPercentage = (value) => {
    return `${value.toFixed(1)}%`;
  };

  const getPerformanceColor = (performance) => {
    switch (performance) {
      case 'excellent': return 'bg-green-100 text-green-800';
      case 'good': return 'bg-blue-100 text-blue-800';
      case 'average': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-red-100 text-red-800';
    }
  };

  const tabs = [
    { id: 'overview', name: 'Total Overview', icon: '📊' },
    { id: 'agents', name: 'Agent Reports', icon: '👥' },
    { id: 'drivers', name: 'Driver Reports', icon: '🚚' },
    { id: 'investors', name: 'Investor Reports', icon: '💰' },
    { id: 'countries', name: 'Country Reports', icon: '🌍' },
    { id: 'country-drivers', name: 'Country-wise Drivers', icon: '🌍🚚' }
  ];

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-lg text-gray-600">Loading reports...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Enhanced Header with Actions */}
      <div className="mb-6 bg-white rounded-lg shadow-sm border p-6">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">📈 Business Reports</h1>
            {lastUpdated && (
              <p className="text-sm text-gray-500">
                Last updated: {lastUpdated.toLocaleString()}
              </p>
            )}
          </div>
          
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            {/* Date Range Controls */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700">From:</label>
                <input
                  type="date"
                  value={dateRange.start}
                  onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700">To:</label>
                <input
                  type="date"
                  value={dateRange.end}
                  onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              </div>
            </div>
            
            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={refreshData}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm font-medium transition-colors"
              >
                <span className={loading ? 'animate-spin' : ''}>🔄</span>
                Refresh
              </button>
              <button
                onClick={() => exportReport('json')}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 text-sm font-medium transition-colors"
              >
                📥 Export
              </button>
            </div>
          </div>
        </div>
        
        {/* Error Display */}
        {error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2">
              <span className="text-red-500">⚠️</span>
              <p className="text-red-700 font-medium">Error loading reports</p>
            </div>
            <p className="text-red-600 text-sm mt-1">{error}</p>
            <button
              onClick={() => loadReportData()}
              className="mt-2 px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
            >
              Retry
            </button>
          </div>
        )}
      </div>

      {/* Enhanced Tab Navigation */}
      <div className="mb-6 bg-white rounded-lg shadow-sm border">
        <nav className="flex space-x-1 p-2 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`whitespace-nowrap py-3 px-4 rounded-lg font-medium text-sm flex items-center gap-2 transition-all duration-200 ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              <span className="text-base">{tab.icon}</span>
              {tab.name}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === 'overview' && reportData.overview && (
        <div className="space-y-8">
          {/* Enhanced Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-xl shadow-sm border border-blue-200">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-blue-600 rounded-lg">
                  <span className="text-2xl">💰</span>
                </div>
                <div className="text-right">
                  <span className="text-green-600 text-sm font-medium">+12.5%</span>
                </div>
              </div>
              <h3 className="text-sm font-medium text-blue-700 mb-1">Total Revenue</h3>
              <p className="text-2xl font-bold text-blue-900">{formatCurrency(reportData.overview.totalRevenue)}</p>
            </div>
            
            <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-xl shadow-sm border border-green-200">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-green-600 rounded-lg">
                  <span className="text-2xl">📦</span>
                </div>
                <div className="text-right">
                  <span className="text-green-600 text-sm font-medium">+8.3%</span>
                </div>
              </div>
              <h3 className="text-sm font-medium text-green-700 mb-1">Total Orders</h3>
              <p className="text-2xl font-bold text-green-900">{reportData.overview.totalOrders?.toLocaleString()}</p>
            </div>
            
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-6 rounded-xl shadow-sm border border-purple-200">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-purple-600 rounded-lg">
                  <span className="text-2xl">📊</span>
                </div>
                <div className="text-right">
                  <span className="text-green-600 text-sm font-medium">+5.1%</span>
                </div>
              </div>
              <h3 className="text-sm font-medium text-purple-700 mb-1">Average Order Value</h3>
              <p className="text-2xl font-bold text-purple-900">{formatCurrency(reportData.overview.avgOrderValue)}</p>
            </div>
            
            <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-6 rounded-xl shadow-sm border border-orange-200">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-orange-600 rounded-lg">
                  <span className="text-2xl">👥</span>
                </div>
                <div className="text-right">
                  <span className="text-green-600 text-sm font-medium">+15.7%</span>
                </div>
              </div>
              <h3 className="text-sm font-medium text-orange-700 mb-1">Total Users</h3>
              <p className="text-2xl font-bold text-orange-900">{reportData.overview.totalUsers?.toLocaleString()}</p>
            </div>
          </div>

          <ChartGrid charts={[
            {
              data: reportData.agents.slice(0, 10),
              type: 'agent-revenue',
              title: 'Top 10 Agents by Revenue'
            },
            {
              data: reportData.drivers.slice(0, 10),
              type: 'driver-earnings',
              title: 'Top 10 Drivers by Earnings'
            },
            {
              data: reportData.countries.slice(0, 8),
              type: 'country-revenue',
              title: 'Revenue Distribution by Country'
            },
            {
              data: [...reportData.agents, ...reportData.drivers],
              type: 'performance-gauge',
              title: 'Overall Team Performance'
            }
          ]} />

          {/* Enhanced Team Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <span className="text-2xl">👥</span>
                </div>
                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">Active</span>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Agents</h3>
              <p className="text-3xl font-bold text-blue-600 mb-1">{reportData.overview.totalAgents}</p>
              <p className="text-sm text-gray-500">Active agents in system</p>
            </div>
            
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-green-100 rounded-lg">
                  <span className="text-2xl">🚚</span>
                </div>
                <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">Available</span>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Drivers</h3>
              <p className="text-3xl font-bold text-green-600 mb-1">{reportData.overview.totalDrivers}</p>
              <p className="text-sm text-gray-500">Delivery drivers available</p>
            </div>
            
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-purple-100 rounded-lg">
                  <span className="text-2xl">💰</span>
                </div>
                <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded-full">Invested</span>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Investors</h3>
              <p className="text-3xl font-bold text-purple-600 mb-1">{reportData.overview.totalInvestors}</p>
              <p className="text-sm text-gray-500">Active investors</p>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'agents' && (
        <div className="space-y-6">
          <ChartGrid charts={[
            {
              data: reportData.agents.slice(0, 10),
              type: 'agent-revenue',
              title: 'Agent Revenue Performance'
            },
            {
              data: reportData.agents,
              type: 'performance-gauge',
              title: 'Average Agent Performance'
            }
          ]} />

          <div className="bg-white rounded-lg shadow border overflow-hidden">
            <div className="p-6 border-b">
              <h2 className="text-xl font-bold text-gray-900">Agent Performance Reports</h2>
              <p className="text-sm text-gray-500 mt-1">Comprehensive analysis of agent performance and KPIs</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Agent</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Revenue</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Orders</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Avg Order Value</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Completion Rate</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Performance</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {reportData.agents.map((agent, index) => (
                    <tr key={agent._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {agent.firstName} {agent.lastName}
                          </div>
                          <div className="text-sm text-gray-500">{agent.email}</div>
                          <div className="text-xs text-gray-400">{agent.country}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">
                        {formatCurrency(agent.totalRevenue)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{agent.totalOrders}</div>
                        <div className="text-xs text-gray-500">
                          {agent.completedOrders} completed, {agent.pendingOrders} pending
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatCurrency(agent.avgOrderValue)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{formatPercentage(agent.completionRate)}</div>
                        <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                          <div 
                            className="bg-blue-600 h-2 rounded-full" 
                            style={{ width: `${Math.min(agent.completionRate, 100)}%` }}
                          ></div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getPerformanceColor(agent.performance)}`}>
                          {agent.performance}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          agent.availability === 'available' ? 'bg-green-100 text-green-800' :
                          agent.availability === 'busy' ? 'bg-yellow-100 text-yellow-800' :
                          agent.availability === 'away' ? 'bg-orange-100 text-orange-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {agent.availability}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {reportData.agents.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No agent data available for the selected date range.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'drivers' && (
        <div className="space-y-6">
          <ChartGrid charts={[
            {
              data: reportData.drivers.slice(0, 10),
              type: 'driver-earnings',
              title: 'Driver Earnings Performance'
            },
            {
              data: reportData.drivers,
              type: 'performance-gauge',
              title: 'Average Driver Performance'
            }
          ]} />

          <div className="bg-white rounded-lg shadow border overflow-hidden">
            <div className="p-6 border-b">
              <h2 className="text-xl font-bold text-gray-900">Driver Performance Reports</h2>
              <p className="text-sm text-gray-500 mt-1">Comprehensive analysis of driver performance and delivery metrics</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Driver</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Earnings</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Deliveries</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Delivery Rate</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Avg Earnings</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Performance</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {reportData.drivers.map((driver, index) => (
                    <tr key={driver._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {driver.firstName} {driver.lastName}
                          </div>
                          <div className="text-sm text-gray-500">{driver.email}</div>
                          <div className="text-xs text-gray-400">{driver.country}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">
                        {formatCurrency(driver.totalEarnings)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{driver.totalDeliveries}</div>
                        <div className="text-xs text-gray-500">
                          {driver.completedDeliveries} completed, {driver.pendingDeliveries} pending
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{formatPercentage(driver.deliveryRate)}</div>
                        <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                          <div 
                            className="bg-green-600 h-2 rounded-full" 
                            style={{ width: `${Math.min(driver.deliveryRate, 100)}%` }}
                          ></div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatCurrency(driver.avgEarningsPerDelivery)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getPerformanceColor(driver.performance)}`}>
                          {driver.performance}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          driver.availability === 'available' ? 'bg-green-100 text-green-800' :
                          driver.availability === 'busy' ? 'bg-yellow-100 text-yellow-800' :
                          driver.availability === 'away' ? 'bg-orange-100 text-orange-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {driver.availability}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {reportData.drivers.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No driver data available for the selected date range.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'investors' && (
        <div className="space-y-6">
          <ChartGrid charts={[
            {
              data: reportData.investors.slice(0, 10),
              type: 'investor-roi',
              title: 'Investor ROI Performance'
            },
            {
              data: reportData.investors,
              type: 'performance-gauge',
              title: 'Average Investor Performance'
            }
          ]} />

          <div className="bg-white rounded-lg shadow border overflow-hidden">
            <div className="p-6 border-b">
              <h2 className="text-xl font-bold text-gray-900">Investor Performance Reports</h2>
              <p className="text-sm text-gray-500 mt-1">Comprehensive analysis of investor returns and portfolio performance</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Investor</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Investment</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Profit</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ROI</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Units Sold</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Profit Margin</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Performance</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {reportData.investors.map((investor, index) => (
                    <tr key={investor._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {investor.firstName} {investor.lastName}
                          </div>
                          <div className="text-sm text-gray-500">{investor.email}</div>
                          <div className="text-xs text-gray-400">{investor.country}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                        {formatCurrency(investor.investmentAmount, investor.investorProfile?.currency)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">
                        {formatCurrency(investor.totalProfit, investor.investorProfile?.currency)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{formatPercentage(investor.roi)}</div>
                        <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                          <div 
                            className={`h-2 rounded-full ${investor.roi >= 15 ? 'bg-green-600' : investor.roi >= 10 ? 'bg-yellow-600' : 'bg-red-600'}`}
                            style={{ width: `${Math.min(Math.max(investor.roi, 0), 100)}%` }}
                          ></div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {investor.unitsSold}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatPercentage(investor.profitMargin)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getPerformanceColor(investor.performance)}`}>
                          {investor.performance}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {reportData.investors.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No investor data available for the selected date range.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'countries' && (
        <div className="space-y-6">
          <ChartGrid charts={[
            {
              data: reportData.countries.slice(0, 8),
              type: 'country-revenue',
              title: 'Revenue by Country'
            },
            {
              data: reportData.countries,
              type: 'performance-gauge',
              title: 'Average Country Performance'
            }
          ]} />

          <div className="bg-white rounded-lg shadow border overflow-hidden">
            <div className="p-6 border-b">
              <h2 className="text-xl font-bold text-gray-900">Country Performance Reports</h2>
              <p className="text-sm text-gray-500 mt-1">Comprehensive analysis of performance metrics by country</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Country</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Revenue</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Orders</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Users</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Team</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Avg Order Value</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Market Penetration</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {reportData.countries.map((country, index) => (
                    <tr key={country.country} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{country.country}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">
                        {formatCurrency(country.totalRevenue)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {country.totalOrders}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{country.totalUsers}</div>
                        <div className="text-xs text-gray-500">{country.customers} customers</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-xs text-gray-500">
                          {country.agents} agents, {country.drivers} drivers, {country.investors} investors
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatCurrency(country.avgOrderValue)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{formatPercentage(country.marketPenetration)}</div>
                        <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                          <div 
                            className="bg-purple-600 h-2 rounded-full" 
                            style={{ width: `${Math.min(country.marketPenetration, 100)}%` }}
                          ></div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {reportData.countries.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No country data available for the selected date range.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'country-drivers' && (
        <div className="space-y-6">
          <ChartGrid charts={[
            {
              data: reportData.countryDrivers.slice(0, 8),
              type: 'country-drivers',
              title: 'Drivers by Country'
            },
            {
              data: reportData.countryDrivers,
              type: 'performance-gauge',
              title: 'Average Country Driver Performance'
            }
          ]} />

          <div className="bg-white rounded-lg shadow border overflow-hidden">
            <div className="p-6 border-b">
              <h2 className="text-xl font-bold text-gray-900">Country-wise Driver Reports</h2>
              <p className="text-sm text-gray-500 mt-1">Comprehensive analysis of driver performance by country</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Country</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Drivers</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Active Drivers</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Earnings</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Deliveries</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Success Rate</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Performance</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {reportData.countryDrivers.map((country, index) => (
                    <tr key={country.country} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{country.country}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {country.totalDrivers}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{country.activeDrivers}</div>
                        <div className="text-xs text-gray-500">
                          {formatPercentage(country.totalDrivers > 0 ? (country.activeDrivers / country.totalDrivers) * 100 : 0)} active
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">
                        {formatCurrency(country.totalEarnings)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{country.totalDeliveries}</div>
                        <div className="text-xs text-gray-500">
                          {country.completedDeliveries} completed
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{formatPercentage(country.deliverySuccessRate)}</div>
                        <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                          <div 
                            className="bg-green-600 h-2 rounded-full" 
                            style={{ width: `${Math.min(country.deliverySuccessRate, 100)}%` }}
                          ></div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {formatCurrency(country.avgEarningsPerDriver)} avg earnings
                        </div>
                        <div className="text-xs text-gray-500">
                          {country.avgDeliveriesPerDriver.toFixed(1)} avg deliveries
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {reportData.countryDrivers.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No country driver data available for the selected date range.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BusinessReports;