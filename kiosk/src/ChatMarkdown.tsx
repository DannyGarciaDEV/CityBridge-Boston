import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const components: Components = {
  p: ({ children }) => (
    <p className="mb-2 mt-0 text-[15px] leading-relaxed text-zinc-900 last:mb-0 sm:text-base">{children}</p>
  ),
  h1: ({ children }) => (
    <h3 className="mb-2 mt-3 text-lg font-semibold tracking-tight text-zinc-950 first:mt-0">{children}</h3>
  ),
  h2: ({ children }) => (
    <h3 className="mb-2 mt-3 text-base font-semibold tracking-tight text-zinc-950 first:mt-0">{children}</h3>
  ),
  h3: ({ children }) => (
    <h4 className="mb-1.5 mt-2.5 text-sm font-semibold text-zinc-800 first:mt-0">{children}</h4>
  ),
  ul: ({ children }) => (
    <ul className="mb-2 mt-2 list-disc space-y-1.5 pl-5 text-[15px] text-zinc-900 sm:text-base">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="mb-2 mt-2 list-decimal space-y-1.5 pl-5 text-[15px] text-zinc-900 sm:text-base">{children}</ol>
  ),
  li: ({ children }) => <li className="leading-relaxed marker:text-zinc-500">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold text-zinc-950">{children}</strong>,
  em: ({ children }) => <em className="italic text-zinc-800">{children}</em>,
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="break-words font-medium text-slate-700 underline decoration-zinc-300 underline-offset-2 hover:text-zinc-950"
    >
      {children}
    </a>
  ),
  blockquote: ({ children }) => (
    <blockquote className="my-2 border-l-4 border-sky-300 bg-sky-50/60 py-1 pl-3 text-zinc-800">{children}</blockquote>
  ),
  hr: () => <hr className="my-3 border-zinc-200" />,
  table: ({ children }) => (
    <div className="my-2 max-w-full overflow-x-auto rounded-md border border-zinc-200">
      <table className="min-w-full border-collapse text-left text-sm text-zinc-900">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-zinc-100">{children}</thead>,
  th: ({ children }) => (
    <th className="border border-zinc-200 px-2 py-1.5 font-semibold text-zinc-800">{children}</th>
  ),
  td: ({ children }) => <td className="border border-zinc-200 px-2 py-1.5">{children}</td>,
  pre: ({ children }) => (
    <pre className="mb-2 max-w-full overflow-x-auto rounded-md border border-zinc-700 bg-zinc-900 p-2.5 text-sm text-zinc-100">
      {children}
    </pre>
  ),
  code: ({ className, children, ...props }) => {
    const block = Boolean(className?.includes("language-"));
    if (block) {
      return (
        <code className={`font-mono text-[13px] leading-relaxed sm:text-sm ${className ?? ""}`} {...props}>
          {children}
        </code>
      );
    }
    return (
      <code
        className="rounded bg-zinc-200/90 px-1.5 py-0.5 font-mono text-[0.88em] text-zinc-900"
        {...props}
      >
        {children}
      </code>
    );
  },
};

export function ChatMarkdown({ content }: { content: string }) {
  return (
    <div className="chat-markdown min-w-0">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components} skipHtml>
        {content}
      </ReactMarkdown>
    </div>
  );
}
