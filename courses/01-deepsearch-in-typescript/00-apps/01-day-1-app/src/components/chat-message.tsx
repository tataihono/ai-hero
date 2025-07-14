import ReactMarkdown, { type Components } from "react-markdown";
import type { Message } from "ai";
import { Wrench, CheckCircle, Clock, ExternalLink } from "lucide-react";

export type MessagePart = NonNullable<Message["parts"]>[number];

interface ChatMessageProps {
  message: Message;
  userName: string;
}

const components: Components = {
  // Override default elements with custom styling
  p: ({ children }) => <p className="mb-4 first:mt-0 last:mb-0">{children}</p>,
  ul: ({ children }) => <ul className="mb-4 list-disc pl-4">{children}</ul>,
  ol: ({ children }) => <ol className="mb-4 list-decimal pl-4">{children}</ol>,
  li: ({ children }) => <li className="mb-1">{children}</li>,
  code: ({ className, children, ...props }) => (
    <code className={`${className ?? ""}`} {...props}>
      {children}
    </code>
  ),
  pre: ({ children }) => (
    <pre className="mb-4 overflow-x-auto rounded-lg bg-gray-700 p-4">
      {children}
    </pre>
  ),
  a: ({ children, ...props }) => (
    <a
      className="text-blue-400 underline"
      target="_blank"
      rel="noopener noreferrer"
      {...props}
    >
      {children}
    </a>
  ),
};

const Markdown = ({ children }: { children: string }) => {
  return <ReactMarkdown components={components}>{children}</ReactMarkdown>;
};

const TextPart = ({
  part,
}: {
  part: Extract<MessagePart, { type: "text" }>;
}) => {
  return (
    <div className="prose prose-invert max-w-none">
      <Markdown>{part.text}</Markdown>
    </div>
  );
};

const ToolInvocationPart = ({
  part,
}: {
  part: Extract<MessagePart, { type: "tool-invocation" }>;
}) => {
  const { toolInvocation } = part;

  const getStatusIcon = () => {
    switch (toolInvocation.state) {
      case "partial-call":
        return <Clock className="size-4 text-yellow-400" />;
      case "call":
        return <Wrench className="size-4 text-blue-400" />;
      case "result":
        return <CheckCircle className="size-4 text-green-400" />;
      default:
        return <Wrench className="size-4 text-gray-400" />;
    }
  };

  const getStatusText = () => {
    switch (toolInvocation.state) {
      case "partial-call":
        return "Calling tool...";
      case "call":
        return "Tool called";
      case "result":
        return "Tool completed";
      default:
        return "Tool invocation";
    }
  };

  const formatToolName = (name: string) => {
    return name
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  const renderJsonValue = (value: any, depth = 0): React.ReactNode => {
    if (value === null) return <span className="text-gray-500">null</span>;
    if (typeof value === "undefined")
      return <span className="text-gray-500">undefined</span>;
    if (typeof value === "string")
      return <span className="text-green-300">"{value}"</span>;
    if (typeof value === "number")
      return <span className="text-blue-300">{value}</span>;
    if (typeof value === "boolean")
      return <span className="text-purple-300">{String(value)}</span>;

    if (Array.isArray(value)) {
      if (value.length === 0) return <span className="text-gray-500">[]</span>;
      return (
        <div className="ml-4">
          <span className="text-gray-400">[</span>
          {value.map((item, index) => (
            <div key={index} className="ml-4">
              {renderJsonValue(item, depth + 1)}
              {index < value.length - 1 && (
                <span className="text-gray-400">,</span>
              )}
            </div>
          ))}
          <span className="text-gray-400">]</span>
        </div>
      );
    }

    if (typeof value === "object") {
      const keys = Object.keys(value);
      if (keys.length === 0)
        return <span className="text-gray-500">{"{}"}</span>;
      return (
        <div className="ml-4">
          <span className="text-gray-400">{"{"}</span>
          {keys.map((key, index) => (
            <div key={key} className="ml-4">
              <span className="text-yellow-300">"{key}"</span>
              <span className="text-gray-400">: </span>
              {renderJsonValue(value[key], depth + 1)}
              {index < keys.length - 1 && (
                <span className="text-gray-400">,</span>
              )}
            </div>
          ))}
          <span className="text-gray-400">{"}"}</span>
        </div>
      );
    }

    return <span className="text-gray-300">{String(value)}</span>;
  };

  const renderUserFriendlyResult = (result: any): React.ReactNode => {
    // Handle common tool result patterns
    if (result && typeof result === "object") {
      // Search results
      if (Array.isArray(result) && result.length > 0 && result[0].title) {
        return (
          <div className="space-y-3">
            <div className="mb-2 text-sm text-gray-400">
              Found {result.length} result{result.length !== 1 ? "s" : ""}
            </div>
            {result.slice(0, 3).map((item, index) => (
              <div
                key={index}
                className="rounded-lg border border-gray-600 bg-gray-800/30 p-3"
              >
                {item.title && (
                  <div className="mb-1 font-medium text-gray-200">
                    {item.title}
                  </div>
                )}
                {item.snippet && (
                  <div className="line-clamp-3 text-sm text-gray-400">
                    {item.snippet}
                  </div>
                )}
                {item.url && (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-block text-xs text-blue-400 hover:text-blue-300"
                  >
                    View source →
                  </a>
                )}
              </div>
            ))}
            {result.length > 3 && (
              <div className="text-xs text-gray-500">
                +{result.length - 3} more results
              </div>
            )}
          </div>
        );
      }

      // File content or code
      if (result.content || result.text || result.code) {
        const content = result.content || result.text || result.code;
        return (
          <div className="space-y-2">
            {result.fileName && (
              <div className="text-sm font-medium text-gray-300">
                📄 {result.fileName}
              </div>
            )}
            <div className="rounded-lg border border-gray-600 bg-gray-800/50 p-3">
              <pre className="overflow-x-auto whitespace-pre-wrap text-sm text-gray-300">
                {content}
              </pre>
            </div>
          </div>
        );
      }

      // Simple key-value pairs
      if (Object.keys(result).length <= 5) {
        return (
          <div className="space-y-2">
            {Object.entries(result).map(([key, value]) => (
              <div key={key} className="flex items-start gap-3">
                <span className="min-w-0 flex-shrink-0 text-sm font-medium text-gray-400">
                  {key
                    .replace(/([A-Z])/g, " $1")
                    .replace(/^./, (str) => str.toUpperCase())}
                  :
                </span>
                <span className="flex-1 text-sm text-gray-300">
                  {typeof value === "string" ? value : JSON.stringify(value)}
                </span>
              </div>
            ))}
          </div>
        );
      }

      // Large objects - show as structured data
      return (
        <div className="space-y-2">
          {Object.entries(result)
            .slice(0, 10)
            .map(([key, value]) => (
              <div
                key={key}
                className="border-b border-gray-600 pb-2 last:border-b-0"
              >
                <div className="mb-1 text-sm font-medium text-gray-400">
                  {key
                    .replace(/([A-Z])/g, " $1")
                    .replace(/^./, (str) => str.toUpperCase())}
                </div>
                <div className="text-sm text-gray-300">
                  {typeof value === "string" ? (
                    <span>{value}</span>
                  ) : typeof value === "object" && value !== null ? (
                    <span className="text-gray-500">
                      {Array.isArray(value)
                        ? `${value.length} items`
                        : "Object"}
                    </span>
                  ) : (
                    <span>{String(value)}</span>
                  )}
                </div>
              </div>
            ))}
          {Object.keys(result).length > 10 && (
            <div className="pt-2 text-xs text-gray-500">
              +{Object.keys(result).length - 10} more properties
            </div>
          )}
        </div>
      );
    }

    // Simple values
    if (typeof result === "string") {
      return <div className="text-gray-300">{result}</div>;
    }

    if (typeof result === "number") {
      return <div className="font-mono text-blue-300">{result}</div>;
    }

    if (typeof result === "boolean") {
      return <div className="text-purple-300">{result ? "Yes" : "No"}</div>;
    }

    // Fallback to JSON for complex cases
    return (
      <div className="rounded-lg border border-gray-600 bg-gray-800/50 p-3">
        <pre className="overflow-x-auto text-sm text-gray-300">
          {JSON.stringify(result, null, 2)}
        </pre>
      </div>
    );
  };

  return (
    <div className="mb-4 rounded-lg border border-gray-600 bg-gray-700/50 backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-center gap-3 rounded-t-lg border-b border-gray-600 bg-gray-700/50 px-4 py-3">
        <div className="flex size-8 items-center justify-center rounded-full bg-gray-600/50">
          {getStatusIcon()}
        </div>
        <div className="flex-1">
          <div className="font-medium text-gray-200">
            {formatToolName(toolInvocation.toolName)}
          </div>
          <div className="text-xs text-gray-400">{getStatusText()}</div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {toolInvocation.state === "call" ||
        toolInvocation.state === "partial-call" ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="size-2 rounded-full bg-blue-400"></div>
              <span className="text-sm font-medium text-gray-300">
                Arguments
              </span>
            </div>
            <div className="rounded-lg border border-gray-600 bg-gray-800/50 p-3 font-mono text-sm">
              {renderJsonValue(toolInvocation.args)}
            </div>
          </div>
        ) : null}

        {toolInvocation.state === "result" ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="size-2 rounded-full bg-green-400"></div>
              <span className="text-sm font-medium text-gray-300">Result</span>
            </div>
            <div className="rounded-lg border border-gray-600 bg-gray-800/50 p-3">
              {renderUserFriendlyResult(toolInvocation.result)}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

const SourcePart = ({
  part,
}: {
  part: Extract<MessagePart, { type: "source" }>;
}) => {
  const { source } = part;

  return (
    <div className="mt-4">
      <a
        href={source.url}
        target="_blank"
        rel="noopener noreferrer"
        className="block rounded-lg border border-gray-600 bg-gray-800/30 p-3 transition-colors hover:bg-gray-800/50"
      >
        <div className="flex items-start gap-3">
          <div className="flex size-6 items-center justify-center rounded-full bg-blue-500/20">
            <ExternalLink className="size-3 text-blue-400" />
          </div>
          <div className="min-w-0 flex-1">
            {source.title && (
              <div className="line-clamp-2 font-medium text-gray-200">
                {source.title}
              </div>
            )}
          </div>
        </div>
      </a>
    </div>
  );
};

const MessagePartRenderer = ({ part }: { part: MessagePart }) => {
  switch (part.type) {
    case "text":
      return <TextPart part={part} />;
    case "tool-invocation":
      return <ToolInvocationPart part={part} />;
    case "source":
      return <SourcePart part={part} />;
    default:
      return null;
  }
};

export const ChatMessage = ({ message, userName }: ChatMessageProps) => {
  const isAI = message.role === "assistant";

  return (
    <div className="mb-6">
      <div
        className={`rounded-lg p-4 ${
          isAI ? "bg-gray-800 text-gray-300" : "bg-gray-900 text-gray-300"
        }`}
      >
        <p className="mb-2 text-sm font-semibold text-gray-400">
          {isAI ? "AI" : userName}
        </p>

        {message.parts ? (
          <div>
            {message.parts.map((part, index) => (
              <MessagePartRenderer key={index} part={part} />
            ))}
          </div>
        ) : (
          // Fallback for messages without parts (legacy support)
          <div className="prose prose-invert max-w-none">
            <Markdown>{message.content || ""}</Markdown>
          </div>
        )}
      </div>
    </div>
  );
};
