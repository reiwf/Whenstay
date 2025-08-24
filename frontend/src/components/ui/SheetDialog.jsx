// import { X } from 'lucide-react'

// export default function SheetDialog({
//   open,
//   onClose,
//   title,
//   children,
//   align = 'center',           // 'center' | 'bottom'
//   size = 'md',                // 'sm' | 'md' | 'lg'
// }) {
//   if (!open) return null

//   const sizes = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg' }
//   const position = align === 'bottom' ? 'items-end' : 'items-center'

//   return (
//     <div className="fixed inset-0 z-50">
//       <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
//       <div className={`absolute inset-0 flex ${position} justify-center p-4`}>
//         <div
//           className={[
//             'w-full', sizes[size],
//             'rounded-2xl bg-white shadow-xl ring-1 ring-slate-200',
//             align === 'bottom' ? 'rounded-b-none sm:rounded-2xl' : '',
//           ].join(' ')}
//         >
//           {/* header */}
//           <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
//             <h3 className="text-base font-semibold text-slate-900">{title}</h3>
//             <button
//               onClick={onClose}
//               className="p-2 rounded-full hover:bg-slate-100 active:bg-slate-200"
//               aria-label="Close"
//             >
//               <X className="w-5 h-5 text-slate-600" />
//             </button>
//           </div>

//           {/* content */}
//           <div className="px-4 py-3 max-h-[65vh] overflow-y-auto">
//             <div className="readable">
//               {children}
//             </div>
//           </div>
//         </div>
//       </div>
//     </div>
//   )
// }
