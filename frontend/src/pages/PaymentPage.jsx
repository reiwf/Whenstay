import React, { useState, useEffect, useMemo } from 'react';
import { 
  CreditCard, 
  RefreshCw, 
  Download, 
  Search, 
  Filter,
  Eye,
  Undo,
  TrendingUp,
  AlertCircle,
  Calendar,
  DollarSign,
  Users,
  MoreVertical,
  CheckCircle,
  XCircle,
  Clock,
  ArrowUpRight,
  ArrowDownLeft,
  FileText
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useTranslation } from 'react-i18next';

// Layout Components
import DashboardLayout from '../components/layout/DashboardLayout';

// UI Components
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../components/ui/dropdown-menu';
import { Alert, AlertDescription } from '../components/ui/alert';
import DataTableAdvanced from '../components/ui/DataTableAdvanced';

// API import
import { paymentAPI } from '../services/api';

// Status badge component
const StatusBadge = ({ status, type = 'status' }) => {
  const getStatusConfig = () => {
    if (type === 'transaction') {
      switch (status) {
        case 'payment':
          return { variant: 'default', className: 'bg-green-100 text-green-800 border-green-200', icon: ArrowUpRight };
        case 'refund':
        case 'partial_refund':
          return { variant: 'destructive', className: 'bg-red-100 text-red-800 border-red-200', icon: ArrowDownLeft };
        case 'void':
          return { variant: 'secondary', className: 'bg-gray-100 text-gray-800 border-gray-200', icon: XCircle };
        default:
          return { variant: 'outline', className: '', icon: FileText };
      }
    }

    switch (status) {
      case 'succeeded':
        return { variant: 'default', className: 'bg-green-100 text-green-800 border-green-200', icon: CheckCircle };
      case 'pending':
      case 'requires_action':
        return { variant: 'outline', className: 'bg-yellow-100 text-yellow-800 border-yellow-200', icon: Clock };
      case 'failed':
      case 'canceled':
        return { variant: 'destructive', className: 'bg-red-100 text-red-800 border-red-200', icon: XCircle };
      default:
        return { variant: 'secondary', className: '', icon: FileText };
    }
  };

  const { className, icon: Icon } = getStatusConfig();

  return (
    <Badge className={className}>
      <Icon className="w-3 h-3 mr-1" />
      {status}
    </Badge>
  );
};

// Import PaymentDrawer component
import PaymentDrawer from '../components/payment/PaymentDrawer';

// Main Payment Management Page Component
const PaymentPage = () => {
  const { t } = useTranslation();
  const [activeSection, setActiveSection] = useState('payments');
  
  // State management
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState(null);
  
  // Filter states
  const [filters, setFilters] = useState({
    search: '',
    status: 'all',
    service_type: 'all',
    transaction_type: 'all',
    date_from: '',
    date_to: '',
    page: 1,
    limit: 20,
    sort_by: 'created_at',
    sort_order: 'desc'
  });
  
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0
  });

  const [summary, setSummary] = useState({
    total_payments: 0,
    total_refunds: 0,
    total_payment_amount: 0,
    total_refund_amount: 0
  });

  // Load data on component mount and filter changes
  useEffect(() => {
    fetchPayments();
  }, [filters]);

  const fetchPayments = async () => {
    setLoading(true);
    try {
      // Filter out 'all' values and empty strings before sending to API
      const apiFilters = Object.entries(filters).reduce((acc, [key, value]) => {
        if (value && value !== 'all' && value !== '') {
          acc[key] = value;
        } else if (key === 'page' || key === 'limit' || key === 'sort_by' || key === 'sort_order') {
          // Always include pagination and sorting parameters
          acc[key] = value;
        }
        return acc;
      }, {});

      const response = await paymentAPI.getPayments(apiFilters);
      console.log('API Response:', response.data);
      console.log('Payments array:', response.data.payments);
      console.log('Payments length:', response.data.payments?.length);
      setPayments(response.data.payments || []);
      setPagination(response.data.pagination);
      setSummary(response.data.summary);
    } catch (error) {
      console.error('Error fetching payments:', error);
    } finally {
      setLoading(false);
    }
  };


  const handleFilterChange = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value,
      page: 1 // Reset to first page when filters change
    }));
  };

  const handleExport = async () => {
    try {
      const blob = await paymentAPI.exportPayments(filters);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `payments-export-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error exporting payments:', error);
      alert('Failed to export payments');
    }
  };

  const formatCurrency = (amount, currency = 'JPY') => {
    return new Intl.NumberFormat('ja-JP', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  // Define columns for DataTableAdvanced
  const paymentColumns = [
    {
      accessorKey: 'stripe_transaction_id',
      header: 'Transaction',
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{row.original.stripe_transaction_id}</div>
          <StatusBadge status={row.original.transaction_type} type="transaction" />
        </div>
      ),
    },
    {
      accessorKey: 'booking_name',
      header: 'Guest',
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{row.original.booking_name}</div>
          <div className="text-sm text-gray-600">{row.original.booking_email}</div>
        </div>
      ),
    },
    {
      accessorKey: 'amount',
      header: 'Amount',
      cell: ({ row }) => (
        <span className="font-medium">
          {formatCurrency(row.original.amount, row.original.currency)}
        </span>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      accessorKey: 'service_type',
      header: 'Service',
      cell: ({ getValue }) => getValue(),
    },
    {
      accessorKey: 'created_at',
      header: 'Date',
      cell: ({ getValue }) => format(parseISO(getValue()), 'PPp'),
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm">
              <MoreVertical className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem 
              onClick={() => setSelectedPayment(row.original.payment_intent_id)}
            >
              <Eye className="w-4 h-4 mr-2" />
              View Details
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  // Custom search function for payments
  const customPaymentSearch = (payment, searchValue) => {
    const searchableFields = [
      payment.stripe_transaction_id,
      payment.booking_name,
      payment.booking_email,
      payment.service_type,
      payment.status,
      payment.transaction_type,
    ];
    
    return searchableFields.some(field => 
      field?.toString().toLowerCase().includes(searchValue)
    );
  };

  return (
    <DashboardLayout
      activeSection={activeSection}
      onSectionChange={setActiveSection}
      pageTitle="Payment Management"
      pageSubtitle="Track and manage all payment transactions"
      pageAction={
        <div className="flex gap-2">
          <Button onClick={fetchPayments} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={handleExport} variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      }
    >
      {/* Full-width Content */}
      <div className="px-4 sm:px-6 lg:px-8 py-6 fade-in">
        <div className="space-y-6">

          {/* Payment Table */}
          <DataTableAdvanced
            data={payments}
            columns={paymentColumns}
            searchable={true}
            filterable={true}
            exportable={true}
            pageSize={20}
            pageSizeOptions={[10, 20, 50, 100]}
            loading={loading}
            emptyMessage="No payment transactions found"
            emptyIcon={CreditCard}
            customSearchFunction={customPaymentSearch}
            dateRangeColumn="created_at"
            onRowClick={(payment) => setSelectedPayment(payment.payment_intent_id)}
            className="bg-white rounded-lg border shadow-sm"
          />

          {/* Payment Drawer */}
          <PaymentDrawer
            paymentId={selectedPayment}
            isOpen={!!selectedPayment}
            onClose={() => setSelectedPayment(null)}
          />
        </div>
      </div>
    </DashboardLayout>
  );
};

export default PaymentPage;
