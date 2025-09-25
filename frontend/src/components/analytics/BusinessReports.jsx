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

  const loadReportData = async () => {
    setLoading(true);
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
    } catch (error) {
      console.error('Error loading report data:', error);
    } finally {
      setLoading(false);
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
      <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl font-bold text-gray-900">Business Reports</h1>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">From:</label>
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">To:</label>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      <div className="mb-6 border-b border-gray-200">
        <nav className="-mb-px flex space-x-8 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <span>{tab.icon}</span>
              {tab.name}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === 'overview' && reportData.overview && (
        <div className="space-y-6">
          <SummaryCards cards={[
            {
              title: 'Total Revenue',
              value: reportData.overview.totalRevenue,
              type: 'revenue',
              icon: '💰',
              trend: Math.random() * 20 - 10
            },
            {
              title: 'Total Orders',
              value: reportData.overview.totalOrders,
              type: 'orders',
              icon: '📦',
              trend: Math.random() * 15 - 5
            },
            {
              title: 'Average Order Value',
              value: reportData.overview.avgOrderValue,
              type: 'revenue',
              icon: '📊',
              trend: Math.random() * 10 - 5
            },
            {
              title: 'Total Users',
              value: reportData.overview.totalUsers,
              type: 'users',
              icon: '👥',
              trend: Math.random() * 25 - 10
            }
          ]} />

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

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-lg shadow border">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">👥 Agents</h3>
              <p className="text-2xl font-bold text-blue-600">{reportData.overview.totalAgents}</p>
              <p className="text-sm text-gray-500">Active agents in system</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow border">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">🚚 Drivers</h3>
              <p className="text-2xl font-bold text-green-600">{reportData.overview.totalDrivers}</p>
              <p className="text-sm text-gray-500">Delivery drivers available</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow border">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">💰 Investors</h3>
              <p className="text-2xl font-bold text-purple-600">{reportData.overview.totalInvestors}</p>
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