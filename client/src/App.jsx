import { useState, useEffect, useRef } from 'react';
import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000';

function App() {
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      sender: 'bot',
      type: 'text',
      text: "Hello! I am your **Website Crawler Bot** 🕸️.\n\nProvide me a website URL (e.g., \`example.com\` or \`https://react.dev\`), and I will crawl internal pages within that domain using a BFS queue, respecting a rate limit of 500ms, and extract clean text contents using **Axios** and **Cheerio**!",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [expandedPages, setExpandedPages] = useState({}); // format: { [messageId]: url }
  const chatEndRef = useRef(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const isUrl = (str) => {
    const pattern = new RegExp(
      '^(https?:\\/\\/)?' + 
        '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|' + 
        '((\\d{1,3}\\.){3}\\d{1,3}))' + 
        '(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*' + 
        '(\\?[;&a-z\\d%_.~+=-]*)?' + 
        '(\\#[-a-z\\d_]*)?$', 
      'i'
    );
    return pattern.test(str.trim()) || (str.includes('.') && !str.includes(' '));
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    const userText = inputValue.trim();
    const messageId = Date.now().toString();
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    setMessages((prev) => [
      ...prev,
      {
        id: messageId,
        sender: 'user',
        type: 'text',
        text: userText,
        timestamp
      }
    ]);

    setInputValue('');

    if (isUrl(userText)) {
      setLoading(true);
      try {
        const response = await axios.post(`${API_BASE_URL}/api/crawl`, { url: userText });
        const data = response.data;
        
        setMessages((prev) => [
          ...prev,
          {
            id: `bot-res-${messageId}`,
            sender: 'bot',
            type: 'crawl_result',
            totalPages: data.totalPages,
            pages: data.pages,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ]);
        
        // Auto-expand the first page crawled in this response
        if (data.pages && data.pages.length > 0) {
          setExpandedPages(prev => ({
            ...prev,
            [`bot-res-${messageId}`]: data.pages[0].url
          }));
        }

      } catch (err) {
        setMessages((prev) => [
          ...prev,
          {
            id: `bot-err-${messageId}`,
            sender: 'bot',
            type: 'error',
            text: `${err.message || 'Crawl failed. Make sure the server is reachable and target URL accepts incoming scraper traffic.'}`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ]);
      } finally {
        setLoading(false);
      }
    } else {
      setLoading(true);
      setTimeout(() => {
        setMessages((prev) => [
          ...prev,
          {
            id: `bot-reply-${messageId}`,
            sender: 'bot',
            type: 'text',
            text: `Please enter a valid website link or domain (e.g. \`example.com\` or \`https://react.dev\`) so I can invoke the BFS crawler!`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ]);
        setLoading(false);
      }, 500);
    }
  };

  const togglePageExpand = (messageId, url) => {
    setExpandedPages(prev => ({
      ...prev,
      [messageId]: prev[messageId] === url ? null : url
    }));
  };

  return (
    <div className="min-h-screen bg-[#05080c] flex items-center justify-center p-2 sm:p-4 selection:bg-teal-500/30">
      {/* Visual background glows */}
      <div className="absolute top-10 left-10 w-72 h-72 rounded-full bg-teal-600/10 blur-[100px] pointer-events-none"></div>
      <div className="absolute bottom-10 right-10 w-80 h-80 rounded-full bg-emerald-600/10 blur-[120px] pointer-events-none"></div>

      {/* Main Fixed Chat Box Container */}
      <div className="w-full max-w-[720px] h-[660px] max-h-[92vh] bg-[#090e15] border border-teal-950/60 rounded-3xl shadow-2xl flex flex-col overflow-hidden z-10 backdrop-blur-md">
        
        {/* Chatbox Header */}
        <div className="px-5 py-4 border-b border-teal-950/40 bg-[#0b121c] flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-teal-500 to-emerald-400 flex items-center justify-center shadow-lg shadow-teal-500/20">
              <svg className="w-5 h-5 text-gray-900 animate-spin" style={{ animationDuration: '6s' }} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-wide">BFS Queue Crawler Bot</h2>
              <span className="text-[10px] text-teal-500/70 font-medium">Node & Axios & Cheerio Scraper</span>
            </div>
          </div>
          <div className="flex items-center space-x-2 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full">
            <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></div>
            <span className="text-[9px] font-semibold text-emerald-400 uppercase tracking-wider">Active</span>
          </div>
        </div>

        {/* Chat History scroll panel */}
        <div className="flex-grow overflow-y-auto p-4 space-y-4 bg-black/20 scrollbar-thin">
          {messages.map((msg) => {
            const isBot = msg.sender === 'bot';
            return (
              <div key={msg.id} className={`flex ${isBot ? 'justify-start' : 'justify-end'}`}>
                <div className={`w-full max-w-[90%] rounded-2xl px-3.5 py-2.5 ${
                  isBot 
                    ? 'bg-[#101721] border border-teal-950/40 text-gray-300 rounded-tl-none' 
                    : 'bg-teal-600 text-white rounded-tr-none shadow-md shadow-teal-600/10 ml-auto max-w-[70%]'
                }`}>
                  
                  {/* TEXT MESSAGE */}
                  {msg.type === 'text' && (
                    <div className="text-xs leading-relaxed whitespace-pre-line">
                      {msg.text.split('\n\n').map((paragraph, pIdx) => (
                        <p key={pIdx} className={pIdx > 0 ? 'mt-2' : ''}>
                          {paragraph.split('**').map((chunk, cIdx) => {
                            if (cIdx % 2 === 1) {
                              return <strong key={cIdx} className="text-teal-400 font-bold">{chunk}</strong>;
                            }
                            return chunk.split('`').map((code, coIdx) => {
                              if (coIdx % 2 === 1) {
                                return <code key={coIdx} className="bg-black/40 text-emerald-300 px-1 py-0.5 rounded font-mono text-[10px]">{code}</code>;
                              }
                              return code;
                            });
                          })}
                        </p>
                      ))}
                    </div>
                  )}

                  {/* CRAWL RESULTS VIEW */}
                  {msg.type === 'crawl_result' && (
                    <div className="space-y-3.5 w-full">
                      {/* Header */}
                      <div className="flex justify-between items-center border-b border-teal-950/40 pb-2">
                        <div>
                          <h4 className="text-xs font-bold text-white uppercase tracking-wider">Crawl Summary</h4>
                          <span className="text-[10px] text-gray-500">Locked within same domain</span>
                        </div>
                        <span className="bg-teal-500/10 border border-teal-500/25 px-2.5 py-0.5 rounded text-[10px] font-mono text-teal-400">
                          {msg.totalPages} Pages Retrieved
                        </span>
                      </div>

                      {/* Pages List Accordion */}
                      <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1 scrollbar-thin">
                        {msg.pages.map((page, index) => {
                          const isExpanded = expandedPages[msg.id] === page.url;
                          return (
                            <div key={index} className="bg-black/25 rounded-xl border border-teal-950/30 overflow-hidden transition-all duration-200">
                              {/* Header Trigger */}
                              <button 
                                onClick={() => togglePageExpand(msg.id, page.url)}
                                className="w-full text-left px-3 py-2.5 flex items-center justify-between hover:bg-black/40 transition-colors gap-3"
                              >
                                <div className="truncate flex-grow">
                                  <h5 className="text-[11px] font-bold text-white truncate">{page.title || 'Untitled Page'}</h5>
                                  <span className="text-[9px] font-mono text-teal-500 truncate block mt-0.5">{page.url}</span>
                                </div>
                                <svg className={`w-4 h-4 text-gray-500 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-180 text-teal-400' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7"></path>
                                </svg>
                              </button>

                              {/* Accordion Content */}
                              {isExpanded && (
                                <div className="p-3 border-t border-teal-950/20 bg-black/10 text-[10px] space-y-3">
                                  {/* Clean content preview */}
                                  <div>
                                    <span className="text-[9px] uppercase tracking-wider text-gray-500 font-bold block mb-1">Clean Text Content</span>
                                    <div className="max-h-[100px] overflow-y-auto bg-black/30 p-2.5 rounded-lg border border-teal-950/20 text-gray-300 leading-relaxed font-sans whitespace-pre-line scrollbar-thin">
                                      {page.content ? page.content.substring(0, 800) + (page.content.length > 800 ? '...' : '') : 'No readable text content found.'}
                                    </div>
                                  </div>

                                  {/* Extracted same-domain links */}
                                  {page.links && page.links.length > 0 && (
                                    <div>
                                      <span className="text-[9px] uppercase tracking-wider text-gray-500 font-bold block mb-1">Discovered same-domain links ({page.links.length})</span>
                                      <div className="max-h-[80px] overflow-y-auto space-y-1 bg-black/30 p-2.5 rounded-lg border border-teal-950/20 scrollbar-thin">
                                        {page.links.map((link, lIdx) => (
                                          <a key={lIdx} href={link} target="_blank" rel="noopener noreferrer" className="block text-[9px] text-cyan-400 hover:underline truncate font-mono">
                                            {link}
                                          </a>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* ERROR CARD */}
                  {msg.type === 'error' && (
                    <div className="flex items-start space-x-2 text-rose-400">
                      <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                      </svg>
                      <div className="text-xs">
                        <p className="font-bold">Crawling Execution Failed</p>
                        <p className="mt-0.5 text-[10px] opacity-90 leading-relaxed">{msg.text}</p>
                      </div>
                    </div>
                  )}

                  <span className={`text-[8px] mt-1.5 block text-right opacity-50 ${isBot ? 'text-gray-400' : 'text-teal-100'}`}>
                    {msg.timestamp}
                  </span>
                </div>
              </div>
            );
          })}

          {/* Crawling loading animation */}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-[#101721] border border-teal-950/40 rounded-2xl rounded-tl-none px-3.5 py-3 w-full max-w-[80%] space-y-2">
                <div className="flex items-center space-x-2">
                  <div className="w-3.5 h-3.5 border-2 border-teal-400 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-xs font-bold text-white">Crawler Running...</span>
                </div>
                <p className="text-[10px] text-gray-500 leading-normal">
                  Executing BFS traversal. Crawling same-domain endpoints with a rate limit of 500ms between requests. This may take up to 10 seconds.
                </p>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Input Bar Form */}
        <form onSubmit={handleSend} className="p-3 border-t border-teal-950/40 bg-[#0b121c] flex items-center space-x-2">
          <div className="flex-grow flex items-center bg-black/40 border border-teal-950/50 rounded-xl px-3 py-2.5 focus-within:border-teal-500/40 transition-colors">
            <svg className="w-4 h-4 text-gray-500 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"></path>
            </svg>
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Enter site domain to crawl (e.g. example.com)..."
              className="bg-transparent text-xs w-full text-gray-200 outline-none placeholder-gray-500"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !inputValue.trim()}
            className="bg-teal-600 hover:bg-teal-500 disabled:opacity-40 disabled:hover:bg-teal-600 text-white text-xs font-bold px-4 py-3 rounded-xl transition-all active:scale-[0.97] flex-shrink-0"
          >
            Crawl
          </button>
        </form>

      </div>
    </div>
  );
}

export default App;
