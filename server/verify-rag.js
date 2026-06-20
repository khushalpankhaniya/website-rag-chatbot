import axios from "axios";

async function verifyRAG() {
  const baseURL = "http://127.0.0.1:5000/api";
  console.log("=== Starting RAG Pipeline Verification ===\n");

  // 1. Verify Health Endpoint
  try {
    console.log("Testing Health Endpoint...");
    const healthRes = await axios.get(`${baseURL}/health`);
    console.log("Health Response:", healthRes.data);
  } catch (err) {
    console.error("Health Endpoint Failed:", err.message);
    return;
  }

  // 2. Verify Indexing Endpoint
  try {
    console.log("\nTesting Indexing Endpoint (POST /api/index)...");
    const indexData = {
      pages: [
        {
          url: "https://example.com/about",
          title: "About Us",
          content: "Posimyth is a leading digital software solutions provider. We specialize in building next-generation WordPress plugins, advanced design tools, and rich developer interfaces. Our core services include custom plugin development, high-performance web applications, and RAG pipelines."
        },
        {
          url: "https://example.com/services",
          title: "Services",
          content: "We offer key services such as UI design, custom React applications, AI-driven solutions, and enterprise API integrations. Our team is dedicated to visual excellence, fast page loads, and modern SEO integrations."
        }
      ]
    };
    
    const indexRes = await axios.post(`${baseURL}/index`, indexData);
    console.log("Indexing Response:", indexRes.data);
  } catch (err) {
    console.error("Indexing Endpoint Failed:", err.response?.data || err.message);
    return;
  }

  // 3. Verify Chat Endpoint
  try {
    console.log("\nTesting Chat Endpoint (POST /api/chat)...");
    const chatData = {
      question: "What services does the company provide?"
    };
    
    const chatRes = await axios.post(`${baseURL}/chat`, chatData);
    console.log("Chat Response:");
    console.log(JSON.stringify(chatRes.data, null, 2));
  } catch (err) {
    console.error("Chat Endpoint Failed:", err.response?.data || err.message);
  }
}

verifyRAG();
