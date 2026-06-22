import { useState, useEffect, useRef } from 'react';
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? 'http://localhost:5000' : window.location.origin);

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
      text: "Hello! I am your **WebChat AI Assistant** 🤖.",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      sources: []
    }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [expandedPages, setExpandedPages] = useState({});
  const [logs, setLogs] = useState([]);
  const [chunksCount, setChunksCount] = useState(0);

  const chatEndRef = useRef(null);
  const logsContainerRef = useRef(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isThinking]);

  useEffect(() => {
    if (logsContainerRef.current) {
      logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
    }
  }, [logs]);

  const addLog = (message) => {
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setLogs((prev) => [...prev, { id: Date.now() + Math.random(), message, timestamp }]);
  };

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
      setErrorMessage('Please enter a valid website link or domain name (e.g. https://example.com).');
      return;
    }

    let targetUrl = urlInput.trim();
    if (!/^https?:\/\//i.test(targetUrl)) {
      targetUrl = 'https://' + targetUrl;
    }

    setCrawlStatus('crawling');
    setErrorMessage('');
    setCrawledPages([]);
    setLogs([]);
    setChunksCount(0);

    addLog(`Checking robots.txt for ${targetUrl}...`);

    try {
      addLog(`Connecting to crawler backend...`);
      // Start simulated logs to provide rich progression feedback
      const simulatedLogs = [
        "Analyzing domain map structure...",
        "Evaluating robots.txt paths and rules...",
        "Setting up BFS queue traversal...",
        "Scraping same-domain pages with rate limiting...",
        "Extracting page elements and body contents..."
      ];
      
      let simIndex = 0;
      const intervalId = setInterval(() => {
        if (simIndex < simulatedLogs.length) {
          addLog(simulatedLogs[simIndex]);
          simIndex++;
        } else {
          clearInterval(intervalId);
        }
      }, 1500);

      const crawlRes = await axios.post(`${API_BASE_URL}/api/crawl`, { url: targetUrl });
      clearInterval(intervalId);
      
      if (!crawlRes.data.pages || !Array.isArray(crawlRes.data.pages) || crawlRes.data.pages.length === 0) {
        throw new Error('Crawl returned no readable pages. Make sure the website exists and allows scrapers.');
      }
      
      const pages = crawlRes.data.pages;
      setCrawledPages(pages);
      addLog(`Scraped ${pages.length} same-domain pages successfully.`);
      
      setCrawlStatus('indexing');
      addLog(`Splitting content into 1000-character context chunks...`);
      addLog(`Generating vector embeddings via Gemini API...`);
      
      const indexRes = await axios.post(`${API_BASE_URL}/api/index`, { pages });
      
      if (!indexRes.data.success) {
        throw new Error(indexRes.data.error || 'Failed to generate embeddings or index pages inside ChromaDB.');
      }

      setChunksCount(indexRes.data.chunksStored || 0);
      addLog(`Generated embeddings for ${indexRes.data.chunksStored} text chunks.`);
      addLog(`Saved all vectors to website-rag collection inside ChromaDB.`);
      addLog(`System status is now READY.`);

      setCrawlStatus('ready');
      setIndexedUrl(targetUrl);
      
      // Reset chat messages to welcome message + success confirmation
      setMessages([
        {
          id: 'welcome',
          sender: 'bot',
          text: "Hello! I am your **WebChat AI Assistant** 🤖.",
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          sources: []
        },
        {
          id: `system-${Date.now()}`,
          sender: 'bot',
          text: `Successfully crawled and indexed **${pages.length}** pages from **${targetUrl}**!\n\nI have generated vector embeddings and stored them in ChromaDB. Ask me anything about this website!`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          sources: []
        }
      ]);

    } catch (err) {
      console.error(err);
      setCrawlStatus('error');
      const errText = err.response?.data?.details || 
        err.response?.data?.error || 
        err.message || 
        'An error occurred. Check if the server is running on port 5000 and target site is reachable.';
      setErrorMessage(errText);
      addLog(`❌ Error during execution: ${errText}`);
    }
  };

  const sendChatMessage = async (textToSend) => {
    if (!textToSend.trim() || isThinking || crawlStatus !== 'ready') return;

    const userText = textToSend.trim();
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
          text: "Something went wrong. Please try again.",
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          sources: []
        }
      ]);
    } finally {
      setIsThinking(false);
    }
  };

  const handleSendChat = (e) => {
    e.preventDefault();
    sendChatMessage(chatInput);
  };

  const handleSendSuggested = (text) => {
    sendChatMessage(text);
  };

  const togglePageExpand = (url) => {
    setExpandedPages(prev => ({
      ...prev,
      [url]: !prev[url]
    }));
  };

  // Helper to format text with markdown bold and inline code blocks, supporting bullet points
  const renderMessageText = (text) => {
    if (!text) return '';
    
    return text.split('\n').map((line, lIdx) => {
      const isBullet = line.trim().startsWith('- ') || line.trim().startsWith('* ');
      const cleanLine = isBullet ? line.trim().replace(/^[-*]\s+/, '') : line;
      
      const content = cleanLine.split('**').map((chunk, cIdx) => {
        if (cIdx % 2 === 1) {
          return <strong key={cIdx} className="text-white font-bold">{chunk}</strong>;
        }
        return chunk.split('`').map((code, coIdx) => {
          if (coIdx % 2 === 1) {
            return (
              <code key={coIdx} className="bg-[#0F0F0F] text-[#A78BFA] px-1.5 py-0.5 rounded font-mono text-xs border border-[#2D2D2D]">
                {code}
              </code>
            );
          }
          return code;
        });
      });

      if (isBullet) {
        return (
          <li key={lIdx} className="list-disc ml-5 text-sm text-[#F9FAFB] leading-relaxed my-1">
            {content}
          </li>
        );
      }
      return (
        <p key={lIdx} className="text-sm text-[#F9FAFB] leading-relaxed my-1">
          {content}
        </p>
      );
    });
  };

  return (
    <div className="min-h-screen bg-[#0F0F0F] text-[#F9FAFB] p-6 selection:bg-[#7C3AED]/30 font-sans flex flex-col justify-between">
      <div className="w-full max-w-[1400px] mx-auto flex flex-col flex-grow">
        
        {/* Header Section */}
        <header className="w-full flex items-center justify-between mb-6 pb-4 border-b border-[#2D2D2D]">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-xl bg-[#7C3AED] flex items-center justify-center shadow-lg shadow-[#7C3AED]/20">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                WebChat AI
                <span className="h-2 w-2 rounded-full bg-[#10B981] animate-pulse" title="System Ready"></span>
              </h1>
              <span className="text-xs text-[#9CA3AF] font-medium">Chat with any website</span>
            </div>
          </div>
          <div className="flex items-center space-x-2 bg-[#1A1A1A] border border-[#2D2D2D] px-4 py-2 rounded-lg">
            <span className="text-xs font-semibold text-[#9CA3AF]">Backend Node:</span>
            <span className="text-xs font-bold text-[#10B981]">Active</span>
          </div>
        </header>

        {/* Dashboard Grid */}
        <main className="w-full grid grid-cols-1 lg:grid-cols-10 gap-6 flex-grow h-[calc(100vh-140px)] min-h-[600px]">
          
          {/* Left Column (40%) - Control Panel */}
          <section className="lg:col-span-4 flex flex-col space-y-6 overflow-y-auto pr-1">
            
            {/* Crawl Form */}
            <div className="bg-[#1A1A1A] border border-[#2D2D2D] rounded-xl p-5 shadow-lg space-y-4">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">Crawl Configuration</h2>
              <form onSubmit={handleCrawlAndIndex} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#9CA3AF] mb-2">Target Website URL</label>
                  <div className="flex items-center bg-[#0F0F0F] border border-[#2D2D2D] rounded-lg px-3 py-3 focus-within:border-[#7C3AED] focus-within:ring-1 focus-within:ring-[#7C3AED] transition-all">
                    <svg className="w-5 h-5 text-[#9CA3AF]/60 mr-2.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                    </svg>
                    <input
                      type="text"
                      value={urlInput}
                      onChange={(e) => setUrlInput(e.target.value)}
                      placeholder="e.g. https://example.com"
                      disabled={crawlStatus === 'crawling' || crawlStatus === 'indexing'}
                      className="bg-transparent text-sm w-full text-white outline-none placeholder-[#9CA3AF]/30 font-medium"
                    />
                  </div>
                </div>
                
                <button
                  type="submit"
                  disabled={crawlStatus === 'crawling' || crawlStatus === 'indexing' || !urlInput.trim()}
                  className="w-full bg-[#7C3AED] hover:bg-[#7C3AED]/90 disabled:opacity-40 disabled:hover:bg-[#7C3AED] text-white font-bold py-3.5 px-4 rounded-lg text-sm transition-all duration-200 shadow-md active:scale-[0.99] cursor-pointer"
                >
                  {crawlStatus === 'crawling' ? 'Crawling Pages...' : crawlStatus === 'indexing' ? 'Saving to Database...' : 'Start Crawling'}
                </button>
              </form>
            </div>

            {/* Status Information */}
            <div className="bg-[#1A1A1A] border border-[#2D2D2D] rounded-xl p-5 shadow-lg space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#9CA3AF]">Status</span>
                <div className="flex items-center space-x-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${
                    crawlStatus === 'ready' ? 'bg-[#10B981]' :
                    crawlStatus === 'crawling' || crawlStatus === 'indexing' ? 'bg-[#F59E0B] animate-pulse' :
                    crawlStatus === 'error' ? 'bg-[#EF4444]' : 'bg-[#9CA3AF]'
                  }`}></span>
                  <span className={`text-xs font-bold uppercase tracking-wider ${
                    crawlStatus === 'ready' ? 'text-[#10B981]' :
                    crawlStatus === 'crawling' || crawlStatus === 'indexing' ? 'text-[#F59E0B]' :
                    crawlStatus === 'error' ? 'text-[#EF4444]' : 'text-[#9CA3AF]'
                  }`}>
                    {crawlStatus === 'ready' ? 'Indexed' :
                     crawlStatus === 'crawling' ? 'Crawling' :
                     crawlStatus === 'indexing' ? 'Indexing' :
                     crawlStatus === 'error' ? 'Error' : 'Idle'}
                  </span>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 border-t border-[#2D2D2D] pt-4">
                <div className="bg-[#0F0F0F] border border-[#2D2D2D] rounded-lg p-3 text-center">
                  <span className="text-[10px] text-[#9CA3AF] uppercase font-bold tracking-wider">Pages Crawled</span>
                  <p className="text-xl font-bold text-white mt-1">{crawledPages.length}</p>
                </div>
                <div className="bg-[#0F0F0F] border border-[#2D2D2D] rounded-lg p-3 text-center">
                  <span className="text-[10px] text-[#9CA3AF] uppercase font-bold tracking-wider">Chunks Indexed</span>
                  <p className="text-xl font-bold text-white mt-1">{chunksCount}</p>
                </div>
              </div>

              {crawlStatus === 'error' && (
                <div className="bg-[#EF4444]/10 border border-[#EF4444]/20 p-4 rounded-lg text-xs text-[#EF4444] leading-relaxed">
                  <strong>Crawl Error:</strong> {errorMessage}
                </div>
              )}
            </div>

            {/* Simulated Progress Logs */}
            <div className="bg-[#1A1A1A] border border-[#2D2D2D] rounded-xl p-5 shadow-lg flex flex-col flex-grow overflow-hidden min-h-[200px] max-h-[300px]">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-3">Progress Logs</h3>
              <div 
                ref={logsContainerRef}
                className="flex-grow overflow-y-auto space-y-2 pr-1 scrollbar-thin scrollbar-thumb-[#2D2D2D]"
              >
                {logs.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-xs text-[#9CA3AF]/40 italic">
                    No crawler logs yet.
                  </div>
                ) : (
                  logs.map((log) => (
                    <div key={log.id} className="flex items-start text-xs space-x-2 text-[#9CA3AF] py-1 border-b border-[#2D2D2D]/10 last:border-0">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#A78BFA] mt-1.5 flex-shrink-0"></span>
                      <div className="flex-grow">
                        <p className="text-[#F9FAFB] leading-relaxed">{log.message}</p>
                      </div>
                      <span className="text-[10px] text-[#9CA3AF]/50 font-mono flex-shrink-0">{log.timestamp}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Collapsible Scraped Pages details */}
            {crawledPages.length > 0 && (
              <div className="bg-[#1A1A1A] border border-[#2D2D2D] rounded-xl p-5 shadow-lg space-y-3">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">Crawled Pages List</h3>
                <div className="max-h-[220px] overflow-y-auto space-y-2 pr-1 scrollbar-thin scrollbar-thumb-[#2D2D2D]">
                  {crawledPages.map((page, index) => {
                    const isExpanded = !!expandedPages[page.url];
                    return (
                      <div key={index} className="bg-[#0F0F0F] rounded-lg border border-[#2D2D2D] overflow-hidden transition-all duration-200">
                        <button 
                          onClick={() => togglePageExpand(page.url)}
                          type="button"
                          className="w-full text-left px-3 py-2.5 flex items-center justify-between hover:bg-[#1A1A1A] transition-colors gap-3 cursor-pointer"
                        >
                          <div className="truncate flex-grow">
                            <h5 className="text-[11px] font-semibold text-[#F9FAFB] truncate">{page.title || 'Untitled Page'}</h5>
                            <span className="text-[9px] font-mono text-[#9CA3AF]/60 truncate block mt-0.5">{page.url}</span>
                          </div>
                          <svg className={`w-3.5 h-3.5 text-[#9CA3AF] flex-shrink-0 transition-transform ${isExpanded ? 'rotate-180 text-[#A78BFA]' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        {isExpanded && (
                          <div className="p-3 border-t border-[#2D2D2D] bg-[#1A1A1A]/50 text-[10px] space-y-3">
                            <div>
                              <span className="text-[9px] uppercase tracking-wider text-[#9CA3AF] font-bold block mb-1">Scraped Content</span>
                              <div className="max-h-[90px] overflow-y-auto bg-[#0F0F0F] p-2.5 rounded border border-[#2D2D2D] text-[#9CA3AF] leading-relaxed whitespace-pre-line scrollbar-thin">
                                {page.content ? page.content.substring(0, 400) + (page.content.length > 400 ? '...' : '') : 'No text content.'}
                              </div>
                            </div>
                            {page.links && page.links.length > 0 && (
                              <div>
                                <span className="text-[9px] uppercase tracking-wider text-[#9CA3AF] font-bold block mb-1">Internal Links Discovered ({page.links.length})</span>
                                <div className="max-h-[70px] overflow-y-auto space-y-1 bg-[#0F0F0F] p-2.5 rounded border border-[#2D2D2D] scrollbar-thin">
                                  {page.links.map((link, lIdx) => (
                                    <a key={lIdx} href={link} target="_blank" rel="noopener noreferrer" className="block text-[9px] text-[#A78BFA] hover:underline truncate font-mono">
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

          {/* Right Column (60%) - Chat Interface */}
          <section className="lg:col-span-6 bg-[#1A1A1A] border border-[#2D2D2D] rounded-xl flex flex-col overflow-hidden shadow-lg h-[calc(100vh-140px)] min-h-[600px] relative">
            
            {/* Chat Panel Header */}
            <div className="px-5 py-4.5 border-b border-[#2D2D2D] bg-[#1A1A1A] flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <span className="h-2.5 w-2.5 rounded-full bg-[#7C3AED] shadow-sm animate-pulse"></span>
                <h3 className="text-xs font-bold text-[#F9FAFB] uppercase tracking-wider">AI Conversational Assistant</h3>
              </div>
              <div className="flex items-center space-x-3">
                {indexedUrl && (
                  <span className="text-xs text-[#9CA3AF] font-medium truncate max-w-[180px]">
                    Context: <span className="text-[#A78BFA] font-mono font-semibold">{new URL(indexedUrl).hostname}</span>
                  </span>
                )}
                {messages.length > 1 && (
                  <button
                    onClick={() => setMessages([
                      {
                        id: 'welcome',
                        sender: 'bot',
                        text: "Hello! I am your **WebChat AI Assistant** 🤖.",
                        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                        sources: []
                      }
                    ])}
                    type="button"
                    className="text-[10px] bg-[#2D2D2D] hover:bg-[#EF4444]/15 hover:text-[#EF4444] border border-[#3D3D3D] text-[#9CA3AF] px-2.5 py-1 rounded transition-all duration-200 cursor-pointer font-bold uppercase tracking-wider"
                  >
                    Clear Chat
                  </button>
                )}
              </div>
            </div>

            {/* Chat Messages scroll area */}
            <div className="flex-grow overflow-y-auto p-5 space-y-6 bg-[#111111]/30 scrollbar-thin scrollbar-thumb-[#2D2D2D]">
              {messages.map((msg) => {
                const isBot = msg.sender === 'bot';
                return (
                  <div key={msg.id} className={`flex ${isBot ? 'justify-start' : 'justify-end'}`}>
                    <div className={`w-full max-w-[85%] rounded-xl px-4 py-3.5 transition-all ${
                      isBot 
                        ? 'bg-[#1A1A1A] border border-[#2D2D2D] text-[#F9FAFB] rounded-tl-none shadow-md' 
                        : 'bg-[#7C3AED] text-white rounded-tr-none shadow-md ml-auto max-w-[75%]'
                    }`}>
                      
                      {/* Render Text Content */}
                      <div className="text-sm leading-relaxed font-normal">
                        {renderMessageText(msg.text)}
                      </div>

                      {/* Sources Display (Bot answers only) */}
                      {isBot && msg.sources && msg.sources.length > 0 && (
                        <div className="mt-4 pt-3 border-t border-[#2D2D2D]">
                          <span className="text-[10px] uppercase tracking-wider text-[#9CA3AF] font-bold block mb-2">Sources:</span>
                          <div className="flex flex-wrap gap-2">
                            {msg.sources.map((src, sIdx) => (
                              <a 
                                key={sIdx} 
                                href={src.url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="bg-[#7C3AED]/10 border border-[#7C3AED]/20 px-3 py-1.5 rounded-full text-xs text-[#A78BFA] hover:bg-[#7C3AED]/25 transition-all duration-200 flex items-center space-x-1.5 truncate max-w-[220px]"
                                title={src.title || src.url}
                              >
                                <svg className="w-3.5 h-3.5 flex-shrink-0 text-[#A78BFA]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                                <span className="truncate">{src.title || 'Source'}</span>
                              </a>
                            ))}
                          </div>
                        </div>
                      )}

                      <span className={`text-[9px] mt-2 block text-right opacity-40 ${isBot ? 'text-[#9CA3AF]' : 'text-white/70'}`}>
                        {msg.timestamp}
                      </span>
                    </div>
                  </div>
                );
              })}

              {/* Chat empty state with Suggested questions */}
              {messages.length === 1 && !isThinking && (
                <div className="flex-grow flex flex-col items-center justify-center p-6 text-center space-y-6 my-8">
                  <div className="h-16 w-16 rounded-2xl bg-[#7C3AED]/10 border border-[#7C3AED]/20 flex items-center justify-center text-[#A78BFA] shadow-lg shadow-[#7C3AED]/5 animate-pulse">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-base font-bold text-white uppercase tracking-wider">Conversational RAG Chat</h3>
                    <p className="text-xs text-[#9CA3AF] max-w-[340px] leading-relaxed">
                      Select one of the suggested prompts below to immediately retrieve context and generate a response:
                    </p>
                  </div>

                  <div className="w-full max-w-[480px] grid grid-cols-1 gap-3 pt-3">
                    {[
                      "What does this website do?",
                      "What products do they offer?",
                      "How can I contact them?"
                    ].map((q, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSendSuggested(q)}
                        disabled={crawlStatus !== 'ready' || isThinking}
                        type="button"
                        className="w-full text-left bg-[#0F0F0F] border border-[#2D2D2D] hover:border-[#7C3AED] hover:bg-[#7C3AED]/5 text-xs text-white px-4 py-3.5 rounded-lg transition-all duration-200 shadow-md font-medium cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Typing loader dots */}
              {isThinking && (
                <div className="flex justify-start">
                  <div className="bg-[#1A1A1A] border border-[#2D2D2D] rounded-xl rounded-tl-none px-5 py-4 w-auto flex items-center shadow-lg">
                    <span className="flex space-x-1.5 items-center h-2">
                      <span className="h-2 w-2 bg-[#A78BFA] rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                      <span className="h-2 w-2 bg-[#A78BFA] rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                      <span className="h-2 w-2 bg-[#A78BFA] rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                    </span>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Chat locked overlay */}
            {crawlStatus !== 'ready' && (
              <div className="absolute inset-0 bg-[#0F0F0F]/80 backdrop-blur-md z-20 flex flex-col items-center justify-center p-6 text-center select-none">
                <div className="h-16 w-16 rounded-2xl bg-[#1A1A1A] border border-[#2D2D2D] flex items-center justify-center mb-4 text-[#9CA3AF] shadow-lg shadow-[#7C3AED]/5">
                  <svg className="w-8 h-8 animate-pulse text-[#7C3AED]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <h3 className="text-white font-bold text-sm uppercase tracking-wider">Chat Locked</h3>
                <p className="text-xs text-[#9CA3AF] mt-2 max-w-[320px] leading-relaxed">
                  Provide a website URL and click **Start Crawling** on the left panel to unlock the AI conversation.
                </p>
              </div>
            )}

            {/* Input Form area */}
            <form onSubmit={handleSendChat} className="p-4 border-t border-[#2D2D2D] bg-[#1A1A1A] flex items-center space-x-3">
              <div className="flex-grow flex items-center bg-[#0F0F0F] border border-[#2D2D2D] rounded-lg px-4 py-3 focus-within:border-[#7C3AED] focus-within:ring-1 focus-within:ring-[#7C3AED] transition-all">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder={crawlStatus === 'ready' ? `Ask a question about ${new URL(indexedUrl).hostname}...` : "Please index a website first..."}
                  className="bg-transparent text-sm w-full text-white outline-none placeholder-[#9CA3AF]/30 font-medium disabled:opacity-50"
                  disabled={crawlStatus !== 'ready' || isThinking}
                />
              </div>
              <button
                type="submit"
                disabled={crawlStatus !== 'ready' || isThinking || !chatInput.trim()}
                className="bg-[#7C3AED] hover:bg-[#7C3AED]/90 disabled:opacity-40 disabled:hover:bg-[#7C3AED] text-white text-sm font-bold px-6 py-3.5 rounded-lg transition-all duration-200 active:scale-[0.97] flex-shrink-0 flex items-center space-x-2 cursor-pointer shadow-lg shadow-[#7C3AED]/20 disabled:shadow-none"
              >
                <span>Send</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </button>
            </form>

          </section>

        </main>
      </div>
    </div>
  );
}

export default App;
