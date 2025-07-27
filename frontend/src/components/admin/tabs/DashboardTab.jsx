import { CheckCircle, Clock, Users, Building, Home, Shield, RefreshCw } from 'lucide-react'

export default function DashboardTab({ stats, checkins, onRefresh }) {
  return (
    <>
      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-6 mb-8">
          <div className="card">
            <div className="flex items-center">
              <Users className="w-8 h-8 text-primary-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Reservations</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalReservations}</p>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center">
              <CheckCircle className="w-8 h-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Completed</p>
                <p className="text-2xl font-bold text-gray-900">{stats.completedCheckins}</p>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center">
              <Clock className="w-8 h-8 text-yellow-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Pending</p>
                <p className="text-2xl font-bold text-gray-900">{stats.pendingCheckins}</p>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center">
              <Shield className="w-8 h-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Verified</p>
                <p className="text-2xl font-bold text-gray-900">{stats.verifiedCheckins}</p>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center">
              <Building className="w-8 h-8 text-purple-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Properties</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalProperties || 0}</p>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center">
              <Home className="w-8 h-8 text-indigo-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Rooms</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalRooms || 0}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Recent Check-ins */}
      <div className="card">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-semibold text-gray-900">Recent Check-ins</h2>
          <button
            onClick={onRefresh}
            className="text-primary-600 hover:text-primary-700 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {checkins.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Guest
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Room
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Check-in Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Verified
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {checkins.map((checkin) => (
                  <tr key={checkin.reservation_id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {checkin.guest_name}
                        </div>
                        <div className="text-sm text-gray-500">
                          {checkin.guest_email}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {checkin.room_number}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(checkin.check_in_date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`status-badge ${
                        checkin.status === 'completed' ? 'status-completed' :
                        checkin.status === 'invited' ? 'status-pending' :
                        'status-cancelled'
                      }`}>
                        {checkin.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {checkin.admin_verified ? (
                        <CheckCircle className="w-5 h-5 text-green-500" />
                      ) : (
                        <Clock className="w-5 h-5 text-yellow-500" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8">
            <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No check-ins found</p>
            <p className="text-sm text-gray-400 mt-2">
              Create a test reservation to see check-ins here
            </p>
          </div>
        )}
      </div>
    </>
  )
}




