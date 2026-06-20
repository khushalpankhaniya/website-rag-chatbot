import { useState, useEffect, useRef } from 'react';
import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000';

function App() {
  const [urlInput, setUrlInput] = useState('');
  const [crawlStatus, setCrawlStatus] = useState('idle'); // 'idle' | 'crawling' | 'indexing' | 'ready' | 'error'
  const [errorMessage, setErrorMessage] = useState('');
  
  // Crawler results
  const [crawledPages, setCrawledPages] = useState([]);
  const [indexedUrl, setIndexedUrl] = useState('');

  // Chat interface states
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      sender: 'bot',
      text: "Hello! I am your **Website RAG Assistant** 🤖.\n\nEnter a website URL in the control panel on the left to crawl and index it into **ChromaDB**. Once indexing completes, you can chat with me about the website's content, services, values, or any other details!",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      sources: []
    }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [expandedPages, setExpandedPages] = useState({});

  const chatEndRef = useRef(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isThinking]);

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

  const handleCrawlAndIndex = async (e) => {
    e.preventDefault();
    if (!urlInput.trim()) return;

    if (!isUrl(urlInput)) {
      setCrawlStatus('error');
      setErrorMessage('Please enter a valid website link or domain name (e.g. stackdot.in or https://react.dev).');
      return;
    }

    let targetUrl = urlInput.trim();
    if (!/^https?:\/\//i.test(targetUrl)) {
      targetUrl = 'https://' + targetUrl;
    }

    setCrawlStatus('crawling');
    setErrorMessage('');
    setCrawledPages([]);

    try {
      // 1. Crawl Endpoint
      console.log(`Starting crawl on target: ${targetUrl}`);
      const crawlRes = await axios.post(`${API_BASE_URL}/api/crawl`, { url: targetUrl });
      
      if (!crawlRes.data.pages || !Array.isArray(crawlRes.data.pages) || crawlRes.data.pages.length === 0) {
        throw new Error('Crawl returned no readable pages. Make sure the website exists and allows scrapers.');
      }
      
      const pages = crawlRes.data.pages;
      setCrawledPages(pages);
      
      // 2. Index Endpoint
      setCrawlStatus('indexing');
      console.log(`Indexing ${pages.length} pages to ChromaDB...`);
      const indexRes = await axios.post(`${API_BASE_URL}/api/index`, { pages });
      
      if (!indexRes.data.success) {
        throw new Error(indexRes.data.error || 'Failed to generate embeddings or index pages inside ChromaDB.');
      }

      setCrawlStatus('ready');
      setIndexedUrl(targetUrl);
      
      // Add confirmation message to chat
      setMessages((prev) => [
        ...prev,
        {
          id: `system-${Date.now()}`,
          sender: 'bot',
          text: `🎉 Successfully crawled and indexed **${pages.length}** pages from **${targetUrl}**!\n\nI have generated vector embeddings and stored them in ChromaDB. Ask me anything about this website!`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          sources: []
        }
      ]);

    } catch (err) {
      console.error(err);
      setCrawlStatus('error');
      setErrorMessage(
        err.response?.data?.details || 
        err.response?.data?.error || 
        err.message || 
        'An error occurred. Check if the server is running on port 5000 and target site is reachable.'
      );
    }
  };

  const handleSendChat = async (e) => {
    e.preventDefault();
    if (!chatInput.trim() || isThinking || crawlStatus !== 'ready') return;

    const userText = chatInput.trim();
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userMsgId = `user-${Date.now()}`;

    setMessages((prev) => [
      ...prev,
      {
        id: userMsgId,
        sender: 'user',
        text: userText,
        timestamp
      }
    ]);

    const historyPayload = messages
      .filter(msg => msg.id !== 'welcome' && !msg.id.startsWith('system'))
      .map(msg => ({
        sender: msg.sender,
        text: msg.text
      }));

    setChatInput('');
    setIsThinking(true);

    try {
      const response = await axios.post(`${API_BASE_URL}/api/chat`, { 
        question: userText,
        history: historyPayload 
      });
      
      setMessages((prev) => [
        ...prev,
        {
          id: `bot-${Date.now()}`,
          sender: 'bot',
          text: response.data.answer,
          sources: response.data.sources || [],
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } catch (err) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        {
          id: `bot-err-${Date.now()}`,
          sender: 'bot',
          text: `❌ **Failed to retrieve answer.**\n\n${err.response?.data?.details || err.response?.data?.error || err.message || 'Please check if your backend and ChromaDB are active.'}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          sources: []
        }
      ]);
    } finally {
      setIsThinking(false);
    }
  };

  const togglePageExpand = (url) => {
    setExpandedPages(prev => ({
      ...prev,
      [url]: !prev[url]
    }));
  };

  // Helper to format text with markdown bold and inline code blocks
  const renderMessageText = (text) => {
    if (!text) return '';
    return text.split('\n\n').map((paragraph, pIdx) => (
      <p key={pIdx} className={pIdx > 0 ? 'mt-2' : ''}>
        {paragraph.split('**').map((chunk, cIdx) => {
          if (cIdx % 2 === 1) {
            return <strong key={cIdx} className="text-slate-900 font-bold">{chunk}</strong>;
          }
          return chunk.split('`').map((code, coIdx) => {
            if (coIdx % 2 === 1) {
              return <code key={coIdx} className="bg-slate-100 text-slate-800 px-1 py-0.5 rounded font-mono text-[10px] border border-slate-200/80">{code}</code>;
            }
            return code;
          });
        })}
      </p>
    ));
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center p-3 sm:p-6 selection:bg-blue-500/20 text-slate-800 relative overflow-x-hidden">
      
      {/* Title Header bar */}
      <header className="w-full max-w-7xl flex items-center justify-between mb-6 pb-4 border-b border-slate-200/80 z-10 bg-transparent">
        <div className="flex items-center space-x-3">
          <div className="h-10 w-10 rounded-xl bg-slate-900 flex items-center justify-center shadow-md">
            <svg className="w-5.5 h-5.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
            </svg>
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-900 tracking-tight">RAG Web Crawler & Chatbot</h1>
            <span className="text-[11px] text-slate-500 font-medium">ChromaDB Vector Store & Gemini LLM</span>
          </div>
        </div>
        <div className="flex items-center space-x-2 bg-emerald-50 border border-emerald-200 px-3.5 py-1.5 rounded-full shadow-sm">
          <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></div>
          <span className="text-[9px] font-bold text-emerald-700 uppercase tracking-widest">Active</span>
        </div>
      </header>

      {/* Main Dashboard Container */}
      <main className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-12 gap-6 z-10 flex-grow h-[calc(100vh-140px)]">
        
        {/* Left Column: Crawler Panel */}
        <section className="lg:col-span-4 bg-white border border-slate-200/80 rounded-2xl p-5 flex flex-col overflow-hidden shadow-sm h-full">
          <h2 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">Control Panel</h2>
          
          {/* Crawl Submission Form */}
          <form onSubmit={handleCrawlAndIndex} className="space-y-3.5">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                Target Website URL
              </label>
              <div className="flex bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus-within:bg-white focus-within:border-blue-500/80 focus-within:ring-2 focus-within:ring-blue-100 transition-all duration-150">
                <svg className="w-4 h-4 text-slate-400 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"></path>
                </svg>
                <input
                  type="text"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="e.g. stackdot.in"
                  className="bg-transparent text-xs w-full text-slate-800 outline-none placeholder-slate-400 font-medium"
                  disabled={crawlStatus === 'crawling' || crawlStatus === 'indexing'}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={crawlStatus === 'crawling' || crawlStatus === 'indexing' || !urlInput.trim()}
              className="w-full bg-slate-900 hover:bg-slate-800 disabled:opacity-40 disabled:hover:bg-slate-900 text-white text-xs font-semibold py-3 rounded-xl transition-all active:scale-[0.99] shadow-sm cursor-pointer"
            >
              {crawlStatus === 'crawling' ? 'Crawling Pages...' : crawlStatus === 'indexing' ? 'Saving to Database...' : 'Crawl & Index Website'}
            </button>
          </form>

          {/* Status Indicator Screen */}
          <div className="mt-4.5">
            {crawlStatus === 'idle' && (
              <div className="bg-slate-50 border border-slate-200/60 p-3.5 rounded-xl text-center">
                <span className="text-[9px] text-slate-400 font-bold block mb-1 uppercase tracking-widest">Pipeline Status</span>
                <p className="text-xs text-slate-500 leading-normal">Ready. Enter a website URL above to build your vector database.</p>
              </div>
            )}

            {crawlStatus === 'crawling' && (
              <div className="bg-blue-50/50 border border-blue-200/60 p-4 rounded-xl space-y-2 text-blue-700">
                <div className="flex items-center space-x-2.5">
                  <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-xs font-bold">Crawling pages...</span>
                </div>
                <p className="text-[10px] text-blue-600/80 leading-relaxed">
                  Executing BFS traversal. Scraping same-domain URLs with a rate limit of 500ms between requests. This may take up to 10 seconds.
                </p>
              </div>
            )}

            {crawlStatus === 'indexing' && (
              <div className="bg-indigo-50/50 border border-indigo-200/60 p-4 rounded-xl space-y-2 text-indigo-700">
                <div className="flex items-center space-x-2.5">
                  <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-xs font-bold">Indexing contents...</span>
                </div>
                <p className="text-[10px] text-indigo-600/80 leading-relaxed">
                  Splitting text pages into chunks, generating vector embeddings via Gemini, and saving records to ChromaDB.
                </p>
              </div>
            )}

            {crawlStatus === 'ready' && (
              <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-xl flex items-center justify-between shadow-sm">
                <div>
                  <span className="text-[9px] uppercase tracking-wider text-emerald-700 font-bold">Database Active</span>
                  <h4 className="text-xs font-bold text-slate-800 truncate max-w-[200px] mt-0.5">{indexedUrl}</h4>
                </div>
                <span className="bg-emerald-100 text-emerald-800 font-mono text-[10px] px-2.5 py-0.5 rounded-full font-bold">
                  {crawledPages.length} Pages
                </span>
              </div>
            )}

            {crawlStatus === 'error' && (
              <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl space-y-1.5 text-rose-800 shadow-sm">
                <div className="flex items-start space-x-2">
                  <svg className="w-4.5 h-4.5 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                  <div className="text-xs">
                    <p className="font-bold uppercase tracking-wider text-[9px]">Execution Failed</p>
                    <p className="mt-1 text-[11px] leading-relaxed text-rose-700/90">{errorMessage}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* List of crawled pages */}
          {crawledPages.length > 0 && (
            <div className="flex-grow flex flex-col mt-4 overflow-hidden">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                Crawled Pages ({crawledPages.length})
              </span>
              
              <div className="flex-grow overflow-y-auto space-y-2 pr-1 scrollbar-thin">
                {crawledPages.map((page, index) => {
                  const isExpanded = !!expandedPages[page.url];
                  return (
                    <div key={index} className="bg-slate-50/50 rounded-xl border border-slate-200/40 overflow-hidden transition-all duration-200">
                      {/* Accordion Trigger */}
                      <button 
                        onClick={() => togglePageExpand(page.url)}
                        className="w-full text-left px-3 py-2 flex items-center justify-between hover:bg-slate-100/50 transition-colors gap-3 cursor-pointer"
                      >
                        <div className="truncate flex-grow">
                          <h5 className="text-[10px] font-bold text-slate-700 truncate">{page.title || 'Untitled Page'}</h5>
                          <span className="text-[8px] font-mono text-slate-400 truncate block mt-0.5">{page.url}</span>
                        </div>
                        <svg className={`w-3.5 h-3.5 text-slate-400 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-180 text-slate-600' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7"></path>
                        </svg>
                      </button>

                      {/* Accordion Content */}
                      {isExpanded && (
                        <div className="p-2.5 border-t border-slate-200/50 bg-white text-[9px] space-y-2.5">
                          <div>
                            <span className="text-[8px] uppercase tracking-wider text-slate-400 font-bold block mb-1">Scraped Content</span>
                            <div className="max-h-[80px] overflow-y-auto bg-slate-50 p-2 rounded border border-slate-200/60 text-slate-600 leading-relaxed font-sans whitespace-pre-line scrollbar-thin">
                              {page.content ? page.content.substring(0, 500) + (page.content.length > 500 ? '...' : '') : 'No text content.'}
                            </div>
                          </div>

                          {page.links && page.links.length > 0 && (
                            <div>
                              <span className="text-[8px] uppercase tracking-wider text-slate-400 font-bold block mb-1">Discovered Links ({page.links.length})</span>
                              <div className="max-h-[60px] overflow-y-auto space-y-0.5 bg-slate-50 p-2 rounded border border-slate-200/60 scrollbar-thin">
                                {page.links.map((link, lIdx) => (
                                  <a key={lIdx} href={link} target="_blank" rel="noopener noreferrer" className="block text-[8px] text-blue-600 hover:underline truncate font-mono">
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
        </section>

        {/* Right Column: Chat Interface */}
        <section className="lg:col-span-8 bg-white border border-slate-200/80 rounded-2xl flex flex-col overflow-hidden shadow-sm h-full relative">
          
          {/* Chat Panel Header */}
          <div className="px-5 py-4 border-b border-slate-200/80 bg-slate-50/50 flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <span className="h-2 w-2 rounded-full bg-slate-900 shadow-sm"></span>
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Conversational Assistant</h3>
            </div>
            {indexedUrl && (
              <span className="text-[10px] text-slate-500 font-medium">
                Connected to: <span className="text-slate-800 font-mono">{new URL(indexedUrl).hostname}</span>
              </span>
            )}
          </div>

          {/* Chat Messages scroll window */}
          <div className="flex-grow overflow-y-auto p-5 space-y-4.5 bg-slate-50/10 scrollbar-thin">
            {messages.map((msg) => {
              const isBot = msg.sender === 'bot';
              return (
                <div key={msg.id} className={`flex ${isBot ? 'justify-start' : 'justify-end'}`}>
                  <div className={`w-full max-w-[85%] rounded-2xl px-4 py-3.5 ${
                    isBot 
                      ? 'bg-white border border-slate-200/80 text-slate-700 rounded-tl-none shadow-sm' 
                      : 'bg-slate-800 text-white rounded-tr-none shadow-sm ml-auto max-w-[70%]'
                  }`}>
                    
                    {/* Render Text Content */}
                    <div className="text-xs leading-relaxed font-medium">
                      {renderMessageText(msg.text)}
                    </div>

                    {/* Sources Display (Bot answers only) */}
                    {isBot && msg.sources && msg.sources.length > 0 && (
                      <div className="mt-3.5 pt-2.5 border-t border-slate-100">
                        <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold block mb-1.5">References & Sources</span>
                        <div className="flex flex-wrap gap-1.5">
                          {msg.sources.map((src, sIdx) => (
                            <a 
                              key={sIdx} 
                              href={src.url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="bg-white border border-slate-200 px-2.5 py-1 rounded-md text-[9px] text-blue-600 hover:text-blue-500 hover:border-slate-300 transition-all flex items-center space-x-1.5 truncate max-w-[200px]"
                              title={src.title || src.url}
                            >
                              <svg className="w-3 h-3 flex-shrink-0 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"></path>
                              </svg>
                              <span className="truncate">{src.title || 'Source Link'}</span>
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    <span className={`text-[8px] mt-1.5 block text-right opacity-50 ${isBot ? 'text-slate-400' : 'text-slate-300'}`}>
                      {msg.timestamp}
                    </span>
                  </div>
                </div>
              );
            })}

            {/* Thinking / Typings bubble loader */}
            {isThinking && (
              <div className="flex justify-start">
                <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-none px-4 py-3.5 w-full max-w-[80%] space-y-2 shadow-sm">
                  <div className="flex items-center space-x-2">
                    <span className="flex space-x-1">
                      <span className="h-1.5 w-1.5 bg-slate-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                      <span className="h-1.5 w-1.5 bg-slate-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                      <span className="h-1.5 w-1.5 bg-slate-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                    </span>
                    <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">Thinking...</span>
                  </div>
                  <p className="text-[10px] text-slate-500 leading-normal">
                    Gemini is retrieving vector contexts from ChromaDB and generating your grounded answer.
                  </p>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* RAG Not Ready Overlay */}
          {crawlStatus !== 'ready' && (
            <div className="absolute inset-0 bg-white/95 backdrop-blur-sm z-20 flex flex-col items-center justify-center p-6 text-center select-none">
              <div className="h-16 w-16 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center mb-4 text-slate-600 shadow-sm">
                <svg className="w-8 h-8 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path>
                </svg>
              </div>
              <h3 className="text-slate-800 font-bold text-sm uppercase tracking-wider">Chat Locked</h3>
              <p className="text-xs text-slate-500 mt-2 max-w-[320px] leading-relaxed">
                Provide a website link and click **Crawl & Index Website** on the left to start your chatbot conversation.
              </p>
            </div>
          )}

          {/* Chat message input form */}
          <form onSubmit={handleSendChat} className="p-3 border-t border-slate-200 bg-slate-50/50 flex items-center space-x-2">
            <div className="flex-grow flex items-center bg-white border border-slate-250 rounded-xl px-3 py-2.5 focus-within:border-blue-500/85 focus-within:ring-2 focus-within:ring-blue-100 transition-all duration-150">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder={crawlStatus === 'ready' ? `Ask a question about ${new URL(indexedUrl).hostname}...` : "Please index a website first..."}
                className="bg-transparent text-xs w-full text-slate-800 outline-none placeholder-slate-400 font-medium disabled:opacity-50"
                disabled={crawlStatus !== 'ready' || isThinking}
              />
            </div>
            <button
              type="submit"
              disabled={crawlStatus !== 'ready' || isThinking || !chatInput.trim()}
              className="bg-slate-900 hover:bg-slate-800 disabled:opacity-40 disabled:hover:bg-slate-900 text-white text-xs font-semibold px-4.5 py-3 rounded-xl transition-all active:scale-[0.97] flex-shrink-0 flex items-center space-x-1 cursor-pointer"
            >
              <span>Send</span>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3"></path>
              </svg>
            </button>
          </form>

        </section>

      </main>
    </div>
  );
}

export default App;
