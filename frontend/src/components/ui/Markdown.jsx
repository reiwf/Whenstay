import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export default function Markdown({ children }) {
  return (
    <div className="prose prose-slate max-w-none text-[13px] leading-6
                    prose-headings:mt-3 prose-headings:mb-2 prose-h1:text-lg prose-h2:text-base
                    prose-p:my-2 prose-li:my-1 prose-ul:list-disc prose-ol:list-decimal
                    prose-a:text-blue-600 prose-a:underline
                    prose-code:text-[12px] prose-code:before:hidden prose-code:after:hidden
                    prose-pre:text-[12px] prose-pre:leading-5">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {typeof children === 'string' ? children : ''}
      </ReactMarkdown>
    </div>
  )
}
