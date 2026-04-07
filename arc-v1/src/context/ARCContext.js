import React, { createContext, useContext, useState, useCallback } from 'react';

const ARCContext = createContext();

export const ARCProvider = ({ children }) => {
  const [messages, setMessages] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [status, setStatus] = useState('Ready'); // Ready, Listening, Processing, Responding
  const [isSessionActive, setIsSessionActive] = useState(false);

  const addMessage = useCallback((role, content) => {
    setMessages(prev => [...prev, { role, content, timestamp: Date.now() }]);
  }, []);

  const addTask = useCallback((task) => {
    setTasks(prev => [...prev, { ...task, id: Date.now().toString(), status: 'pending' }]);
  }, []);

  const updateTaskStatus = useCallback((taskId, newStatus) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
  }, []);

  const clearConversation = useCallback(() => {
    setMessages([]);
    setTasks([]);
  }, []);

  const value = {
    messages,
    tasks,
    status,
    isSessionActive,
    setStatus,
    setIsSessionActive,
    addMessage,
    addTask,
    updateTaskStatus,
    clearConversation
  };

  return <ARCContext.Provider value={value}>{children}</ARCContext.Provider>;
};

export const useARC = () => {
  const context = useContext(ARCContext);
  if (!context) {
    throw new Error('useARC must be used within an ARCProvider');
  }
  return context;
};
