'use client'

import { useChat } from 'ai/react'
import { useState } from 'react'

export default function ChatInterface() {
  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
    api: '/api/chat',
    // We can pass initial user location here if stored in a global state
    body: {
      // Hardcoded or dynamically fetched location based on selected location
      // userLocation: { lat: 33.6844, lng: 73.0479 }
    }
  })

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] max-w-3xl mx-auto border rounded-lg overflow-hidden bg-background">
      <div className="flex-1 p-4 overflow-y-auto space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-4 text-muted-foreground">
            <h2 className="text-xl font-semibold">How can we help you today?</h2>
            <p>Describe your issue, and we'll find the best professionals near you.</p>
          </div>
        ) : (
          messages.map(m => (
            <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                m.role === 'user' 
                  ? 'bg-blue-600 text-white rounded-br-none' 
                  : 'bg-muted text-foreground rounded-bl-none'
              }`}>
                {m.content}
                {m.toolInvocations?.map(toolInvocation => {
                  const toolCallId = toolInvocation.toolCallId
                  const addResult = 'result' in toolInvocation ? toolInvocation.result : null

                  return (
                    <div key={toolCallId} className="mt-2 p-2 bg-background/50 rounded text-sm text-foreground">
                      <div className="font-semibold text-xs text-muted-foreground uppercase tracking-wider mb-1">
                        Searching nearby...
                      </div>
                      {addResult ? (
                        <div>
                          {addResult.error ? (
                            <span className="text-red-500">Error: {addResult.error}</span>
                          ) : (
                            <div className="space-y-2">
                              {addResult.providers?.map((p: any, idx: number) => (
                                <div key={idx} className="border-b border-border/50 pb-2 last:border-0 last:pb-0">
                                  <div className="font-medium">{p.name}</div>
                                  <div className="text-xs">{p.address}</div>
                                  <div className="text-xs flex items-center gap-1 mt-1">
                                    <span className="text-yellow-500">★</span> {p.rating} ({p.user_ratings_total} reviews)
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="animate-pulse">Fetching results from Google Places...</div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))
        )}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-muted text-foreground rounded-2xl rounded-bl-none px-4 py-2 flex gap-1 items-center">
              <span className="w-2 h-2 rounded-full bg-current animate-bounce" />
              <span className="w-2 h-2 rounded-full bg-current animate-bounce" style={{ animationDelay: '0.2s' }} />
              <span className="w-2 h-2 rounded-full bg-current animate-bounce" style={{ animationDelay: '0.4s' }} />
            </div>
          </div>
        )}
      </div>
      
      <form onSubmit={handleSubmit} className="p-4 bg-muted/50 border-t flex gap-2">
        <input
          className="flex-1 p-3 border rounded-full bg-background focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={input}
          placeholder="E.g., I have a leaking pipe in my kitchen..."
          onChange={handleInputChange}
          disabled={isLoading}
        />
        <button 
          type="submit" 
          disabled={isLoading || !input.trim()}
          className="bg-blue-600 text-white rounded-full px-6 py-2 font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  )
}
