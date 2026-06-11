import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const SherlockReply = ({ content, isStreaming }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    // Clean up template markers from text when copying to clipboard
    const cleanContent = content
      .replace(/---SHERLOCK_TRADE---/g, '')
      .replace(/---END_TRADE---/g, '')
      .replace(/---SHERLOCK_EXPLAIN---/g, '')
      .replace(/---END_EXPLAIN---/g, '')
      .replace(/---SHERLOCK_GENERAL---/g, '')
      .replace(/---END_GENERAL---/g, '')
      .trim();

    navigator.clipboard.writeText(cleanContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Strip the template delimiters from rendering in markdown
  const displayContent = content
    .replace(/---SHERLOCK_TRADE---/g, '')
    .replace(/---END_TRADE---/g, '')
    .replace(/---SHERLOCK_EXPLAIN---/g, '')
    .replace(/---END_EXPLAIN---/g, '')
    .replace(/---SHERLOCK_GENERAL---/g, '')
    .replace(/---END_GENERAL---/g, '')
    .trim();

  return (
    <div className="sherlock-reply">
      {/* Header bar */}
      <div className="reply-header">
        <div className="sherlock-avatar">
          <span>🕵️</span>
          <span className="name">Sherlock</span>
          {isStreaming && <span className="streaming-dot">●</span>}
        </div>
        <button className="copy-btn" onClick={handleCopy}>
          {copied ? '✓ Copied' : '⎘ Copy'}
        </button>
      </div>

      {/* Rich markdown content */}
      <div className="reply-body">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            // Tables — styled like data grids
            table: ({node, ...props}) => (
              <div className="reply-table-wrapper">
                <table className="reply-table" {...props} />
              </div>
            ),
            th: ({node, ...props}) => (
              <th className="reply-th" {...props} />
            ),
            td: ({node, ...props}) => (
              <td className="reply-td" {...props} />
            ),
            // Headers — colored sections
            h2: ({node, ...props}) => (
              <h2 className="reply-h2" {...props} />
            ),
            h3: ({node, ...props}) => (
              <h3 className="reply-h3" {...props} />
            ),
            // Code blocks — monospace terminal style
            code: ({node, inline, ...props}) => 
              inline 
                ? <code className="reply-inline-code" {...props} />
                : <pre className="reply-code-block"><code {...props} /></pre>,
            // Blockquotes — highlighted insight boxes
            blockquote: ({node, ...props}) => (
              <blockquote className="reply-insight" {...props} />
            ),
            // Bold — amber highlight
            strong: ({node, ...props}) => (
              <strong className="reply-bold" {...props} />
            ),
          }}
        >
          {displayContent}
        </ReactMarkdown>

        {/* Streaming cursor */}
        {isStreaming && <span className="cursor-blink">▊</span>}
      </div>
    </div>
  );
};

export default SherlockReply;
