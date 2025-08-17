import { 
  User, 
  AlertCircle 
} from 'lucide-react'

export default function GuestInfoSection({ 
  formData, 
  setFormData, 
  errors, 
  hasCheckinData
}) {
  return (
    <div className="space-y-6">
      {!hasCheckinData && (
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
          <div className="flex items-center">
            <AlertCircle className="w-5 h-5 text-yellow-600 mr-2" />
            <span className="text-sm text-yellow-800">
              No check-in data submitted yet. Guest information will appear here once they complete online check-in.
            </span>
          </div>
        </div>
      )}

      {/* Guest Personal Information */}
      <div>
        <h5 className="text-sm font-medium text-gray-800 mb-3 flex items-center">
          <User className="w-4 h-4 mr-2" />
          Guest Personal Information
          <span className="ml-2 text-sm text-gray-600 font-normal">
            (Guest-Provided Data)
          </span>
          {hasCheckinData && (
            <span className="ml-2 inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
              Data Available
            </span>
          )}
        </h5>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              First Name
            </label>
            <input
              type="text"
              value={formData.guestFirstname}
              onChange={(e) => setFormData({ ...formData, guestFirstname: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
              placeholder="John"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Last Name
            </label>
            <input
              type="text"
              value={formData.guestLastname}
              onChange={(e) => setFormData({ ...formData, guestLastname: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
              placeholder="Smith"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Personal Email
            </label>
            <input
              type="email"
              value={formData.guestMail}
              onChange={(e) => setFormData({ ...formData, guestMail: e.target.value })}
              className={`w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-primary-500 ${
                errors.guestMail ? 'border-red-300' : 'border-gray-300'
              }`}
              placeholder="personal@example.com"
            />
            {errors.guestMail && (
              <p className="text-red-500 text-xs mt-1 flex items-center">
                <AlertCircle className="w-3 h-3 mr-1" />
                {errors.guestMail}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Contact Number
            </label>
            <input
              type="tel"
              value={formData.guestContact}
              onChange={(e) => setFormData({ ...formData, guestContact: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
              placeholder="+1 (555) 123-4567"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Address
            </label>
            <textarea
              value={formData.guestAddress}
              onChange={(e) => setFormData({ ...formData, guestAddress: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
              placeholder="123 Main St, City, State, Country"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
