import { 
  User, 
  AlertCircle 
} from 'lucide-react'
import Section from '../../ui/Section'
import { ListGroup, ListRowLarge } from '../../ui/ListGroup'

export default function GuestInfoSection({ 
  formData, 
  setFormData, 
  errors, 
  hasCheckinData
}) {
  return (
    <div className="space-y-4">
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
      <Section 
        title="Guest Personal Information" 
        subtitle={`Guest-provided data ${hasCheckinData ? '(Data Available)' : ''}`}
      >
        <ListGroup>
          <ListRowLarge
            left="First Name"
            right={
              <input
                type="text"
                value={formData.guestFirstname}
                onChange={(e) => setFormData({ ...formData, guestFirstname: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="John"
              />
            }
          />
          <ListRowLarge
            left="Last Name"
            right={
              <input
                type="text"
                value={formData.guestLastname}
                onChange={(e) => setFormData({ ...formData, guestLastname: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Smith"
              />
            }
          />
          <ListRowLarge
            left="Personal Email"
            right={
              <div className="w-full">
                <input
                  type="email"
                  value={formData.guestMail}
                  onChange={(e) => setFormData({ ...formData, guestMail: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 ${
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
            }
          />
          <ListRowLarge
            left="Contact Number"
            right={
              <input
                type="tel"
                value={formData.guestContact}
                onChange={(e) => setFormData({ ...formData, guestContact: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="+1 (555) 123-4567"
              />
            }
          />
          <ListRowLarge
            left="Address"
            right={
              <textarea
                value={formData.guestAddress}
                onChange={(e) => setFormData({ ...formData, guestAddress: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="123 Main St, City, State, Country"
              />
            }
          />
        </ListGroup>
      </Section>
    </div>
  )
}
