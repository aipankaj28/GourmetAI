import React, { useEffect, useState, useRef, useCallback } from 'react';
import AvatarDisplay from './AvatarDisplay';
import { RemoteTrack } from 'livekit-client';
import VisualMenu from './VisualMenu';
import CartDisplay from './CartDisplay';
import ReceiptDisplay from './ReceiptDisplay';
import { useAppContext } from '../context/AppContext';
import { Category, Intent, LiveAgentState, MenuItem, MealType, ServiceAlert, OrderStatus, ItemStatus } from '../types';
import { FunctionDeclaration, Type } from '@google/genai';
import { startLiveAgent, stopLiveAgent, wakeAgent } from '../services/geminiService';
import Button from './Button';

const CustomerInterface: React.FC = () => {
  const {
    menuItems,
    cart,
    addToCart,
    removeFromCart,
    clearCart,
    taxRates,
    placeOrder,
    generateBill,
    sendServiceAlert,
    updateFilteredMenu,
    filteredMenuItems,
    setFilteredMenuItems,
    tableNumber,
    setTableNumber,
    totalTables,
    orders,
    lastSyncTime,
    syncStatus,
    refreshData,
  } = useAppContext();

  const [activeTab, setActiveTab] = useState<'menu' | 'cart' | 'receipt'>('menu');
  const [receipt, setReceipt] = useState<any | null>(null);
  const [speechOutput, setSpeechOutput] = useState('');
  const [isApiKeySelected, setIsApiKeySelected] = useState<boolean | null>(null);
  const [agentState, setAgentState] = useState<LiveAgentState>({
    isListening: false,
    isSpeaking: false,
    isProcessing: false,
    isAwake: true,
    currentInputTranscription: '',
    currentOutputTranscription: '',
    error: null,
  });

  const [avatarVideoTrack, setAvatarVideoTrack] = useState<RemoteTrack | null>(null);

  const liveSessionRef = useRef<any>(null); // To store the live session instance
  const hasGreetedRef = useRef(false); // To prevent multiple greetings in one session

  const checkApiKey = useCallback(async () => {
    if (window.aistudio && window.aistudio.hasSelectedApiKey) {
      const selected = await window.aistudio.hasSelectedApiKey();
      setIsApiKeySelected(selected);
    } else {
      console.warn('window.aistudio not available. Assuming API key is set.');
      setIsApiKeySelected(true); // Assume true if not in AI Studio environment
    }
  }, []);

  useEffect(() => {
    checkApiKey();
    setFilteredMenuItems(menuItems); // Initialize filtered menu
  }, [checkApiKey, menuItems, setFilteredMenuItems]);

  // Sync receipt with real-time orders
  useEffect(() => {
    if (receipt && orders.length > 0) {
      const updatedOrder = orders.find(o => o.order_id === receipt.order_id);
      if (updatedOrder && JSON.stringify(updatedOrder) !== JSON.stringify(receipt)) {
        console.log('DEBUG: Syncing local receipt with updated order status:', updatedOrder.status);
        setReceipt(updatedOrder);
      }
    }
  }, [orders, receipt]);

  const handleApiKeySelection = async () => {
    if (window.aistudio && window.aistudio.openSelectKey) {
      await window.aistudio.openSelectKey();
      setIsApiKeySelected(true); // Assume success for race condition
    }
  };

  const handleAgentStateChange = (newState: Partial<LiveAgentState>) => {
    setAgentState(prevState => ({ ...prevState, ...newState }));
  };

  const handleSpeechResponse = useCallback((text: string) => {
    setSpeechOutput(text);
    // Optionally clear after a delay
    // setTimeout(() => setSpeechOutput(''), 5000);
  }, []);

  const handleIntent = useCallback(async (intent: Intent, args: Record<string, unknown>) => {
    console.log('Handling intent:', intent, args);
    let agentResponseText = '';

    switch (intent) {
      case Intent.ORDER:
        const itemName = (args.itemName as string)?.toLowerCase();
        const quantity = Number(args.quantity) || 1;
        if (itemName) {
          const item = menuItems.find(mi => mi.name.toLowerCase().includes(itemName));
          if (item && item.availability) {
            await addToCart(item, quantity);
            agentResponseText = `Added ${quantity} ${item.name} to your order. It's now visible in the kitchen.`;
            setActiveTab('cart');
            return { success: true, item: item.name, quantity, message: agentResponseText };
          } else {
            agentResponseText = `Sorry, I couldn't find "${itemName}" or it's unavailable.`;
            return { success: false, message: agentResponseText };
          }
        } else {
          agentResponseText = 'Please specify what you would like to order.';
          return { success: false, message: agentResponseText };
        }

      case Intent.REMOVE:
        const removeName = (args.itemName as string)?.toLowerCase();
        if (removeName) {
          const itemToRemove = cart.find(ci => ci.name.toLowerCase().includes(removeName));
          if (itemToRemove) {
            if (itemToRemove.status === ItemStatus.PENDING) {
              await removeFromCart(itemToRemove.id);
              agentResponseText = `Removed ${itemToRemove.name} from your order.`;
              return { success: true, message: agentResponseText };
            } else {
              agentResponseText = `Sorry, ${itemToRemove.name} is already being prepared or served and cannot be removed.`;
              return { success: false, message: agentResponseText };
            }
          } else {
            agentResponseText = `I couldn't find "${removeName}" in your current order.`;
            return { success: false, message: agentResponseText };
          }
        } else {
          agentResponseText = 'Please specify which item you would like to remove.';
          return { success: false, message: agentResponseText };
        }

      case Intent.QUERY:
        const queryItemName = (args.itemName as string)?.toLowerCase();
        const queryCategory = (args.category as string);
        const queryType = (args.type as string);
        const queryAttribute = (args.attribute as string)?.toLowerCase(); // e.g., "gluten-free", "vegetarian"

        let matchedItems: MenuItem[] = [...menuItems];
        if (queryCategory) {
          matchedItems = matchedItems.filter(item => item.category.toLowerCase().includes(queryCategory.toLowerCase()));
          agentResponseText += `Showing items in ${queryCategory}. `;
        }
        if (queryType) {
          matchedItems = matchedItems.filter(item => item.type.toLowerCase().includes(queryType.toLowerCase()));
          agentResponseText += `Filtered by type ${queryType}. `;
        }
        if (queryItemName) {
          matchedItems = matchedItems.filter(item => item.name.toLowerCase().includes(queryItemName));
          agentResponseText = `Here's what I found for ${queryItemName}. `;
        }
        if (queryAttribute) {
          // Simple attribute check (e.g., assuming ingredients string contains keywords)
          matchedItems = matchedItems.filter(item => item.description.toLowerCase().includes(queryAttribute) || item.name.toLowerCase().includes(queryAttribute));
          agentResponseText += `Filtered by attribute "${queryAttribute}". `;
        }

        if (matchedItems.length > 0) {
          setFilteredMenuItems(matchedItems);
          setActiveTab('menu');
          if (!agentResponseText) agentResponseText = 'Here are some items that match your query.';
          return {
            success: true,
            items: matchedItems.map(i => ({ name: i.name, price: i.price, description: i.description, availability: i.availability })),
            message: agentResponseText
          };
        } else {
          setFilteredMenuItems([]);
          agentResponseText = 'I could not find any items matching your criteria.';
          return { success: false, items: [], message: agentResponseText };
        }

      case Intent.SERVICE:
        const serviceType = (args.serviceType as string);
        if (serviceType) {
          const alert: ServiceAlert = {
            id: crypto.randomUUID(),
            table: tableNumber || 'Online',
            type: serviceType as any,
            message: `Service requested: ${serviceType}`,
            timestamp: new Date().toISOString(),
            resolved: false,
          };
          sendServiceAlert(alert);
          agentResponseText = `A staff member has been alerted for your ${serviceType} request. They will be with you shortly.`;
          setSpeechOutput(agentResponseText);
        }
        break;

      case Intent.BILL:
        console.log('UI DEBUG: Handling Intent.BILL. Args:', args);
        try {
          const confirmCancel = !!args.confirmCancelPending;
          console.log('UI DEBUG: confirmCancel flag:', confirmCancel);
          const order = await generateBill(tableNumber || 'Online', confirmCancel);
          setReceipt(order);
          setActiveTab('receipt');
          agentResponseText = 'Your bill is ready! Please see the receipt on the right.';
          return {
            success: true,
            orderId: order.order_id,
            total: order.total_amount,
            items: order.items_ordered,
            message: agentResponseText
          };
        } catch (error: any) {
          console.log('UI DEBUG: generateBill threw error:', error);
          const errorMessage = error.message || String(error);
          const errorMessageLower = errorMessage.toLowerCase();

          // Handle "Soft" Business Errors (should not turn avatar red)
          const softErrors = [
            'pending_items_detected',
            'currently being prepared',
            'no active orders found',
            'no served items found'
          ];

          const isSoftError = softErrors.some(se => errorMessageLower.includes(se));

          if (isSoftError) {
            if (errorMessageLower.includes('pending_items_detected')) {
              const items = errorMessage.split(': ')[1];
              agentResponseText = `I noticed you still have some items pending: ${items}. Would you like me to cancel them and prepare the bill for the served items?`;

              setAgentState(prev => ({ ...prev, error: null }));
              return {
                success: false,
                code: 'PENDING_ITEMS',
                pendingItems: items,
                message: agentResponseText
              };
            }

            // For other soft errors (Preparing items, No orders, etc.), just clear red state and return message
            agentResponseText = errorMessage;
            setAgentState(prev => ({ ...prev, error: null }));
            return {
              success: false,
              message: agentResponseText
            };
          }

          agentResponseText = errorMessage || 'There was an error generating your bill.';
          console.error('UI ERROR: Hard billing error:', errorMessage);
          setAgentState(prev => ({ ...prev, error: agentResponseText }));
          return { success: false, message: agentResponseText };
        }

      case Intent.NONE:
      default:
        agentResponseText = 'I am sorry, I did not understand that. Can you please rephrase?';
        setSpeechOutput(agentResponseText);
        break;
    }
    // Gemini Live automatically handles TTS for its responses, so `setSpeechOutput` here is mainly for display.
  }, [menuItems, cart, addToCart, clearCart, taxRates, placeOrder, sendServiceAlert, updateFilteredMenu, setFilteredMenuItems, tableNumber]);

  // Ref to always have the latest handleIntent for the voice agent
  const handleIntentRef = useRef(handleIntent);
  useEffect(() => {
    handleIntentRef.current = handleIntent;
  }, [handleIntent]);

  const stableHandleIntent = useCallback(async (intent: Intent, args: Record<string, unknown>) => {
    return await handleIntentRef.current(intent, args);
  }, []);

  const startAgent = useCallback(async () => {
    console.log('UI DEBUG: startAgent function called.');
    if (!isApiKeySelected) {
      handleApiKeySelection();
      return;
    }

    handleAgentStateChange({ isProcessing: true, error: null });

    const functionDeclarations: FunctionDeclaration[] = [
      {
        name: Intent.ORDER,
        parameters: {
          type: Type.OBJECT,
          description: 'Adds an item to the customer\'s order cart.',
          properties: {
            itemName: {
              type: Type.STRING,
              description: 'The name of the menu item to order.',
            },
            quantity: {
              type: Type.NUMBER,
              description: 'The quantity of the item.',
              default: 1,
            },
          },
          required: ['itemName'],
        },
      },
      {
        name: Intent.REMOVE,
        parameters: {
          type: Type.OBJECT,
          description: 'Removes an item from the customer\'s order cart.',
          properties: {
            itemName: {
              type: Type.STRING,
              description: 'The name of the menu item to remove.',
            },
          },
          required: ['itemName'],
        },
      },
      {
        name: Intent.QUERY,
        parameters: {
          type: Type.OBJECT,
          description: 'Answers questions about menu items or filters the menu.',
          properties: {
            itemName: {
              type: Type.STRING,
              description: 'The name of a specific menu item.',
            },
            category: {
              type: Type.STRING,
              description: 'The category of menu items (e.g., Starter, Main Course, Dessert, Drink, Side Dish).',
              enum: Object.values(Category),
            },
            type: {
              type: Type.STRING,
              description: 'The meal type (e.g., Veg, Non-Veg).',
              enum: Object.values(MealType),
            },
            attribute: {
              type: Type.STRING,
              description: 'Specific attribute to query (e.g., gluten-free, spicy).',
            },
          },
          // No required parameters, as it can be a broad query
        },
      },
      {
        name: Intent.SERVICE,
        parameters: {
          type: Type.OBJECT,
          description: 'Requests service from staff (e.g., water, napkins, call server, room service).',
          properties: {
            serviceType: {
              type: Type.STRING,
              description: 'The type of service requested (e.g., "water", "napkins", "send someone", "room service").',
              enum: ['water', 'napkins', 'send someone', 'room service', 'cutlery'],
            },
          },
          required: ['serviceType'],
        },
      },
      {
        name: Intent.BILL,
        parameters: {
          type: Type.OBJECT,
          description: 'Requests the final bill for the current order.',
          properties: {
            confirmCancelPending: {
              type: Type.BOOLEAN,
              description: 'Set to true only if the user has explicitly confirmed they want to cancel pending items and proceed with billing.',
              default: false,
            },
          },
        },
      },
    ];

    try {
      console.log('UI DEBUG: Calling startLiveAgent service.');
      liveSessionRef.current = await startLiveAgent(
        handleAgentStateChange,
        handleSpeechResponse,
        stableHandleIntent,
        functionDeclarations,
        `You are Lisa, an interactive avatar for an Indian restaurant. 
         Current Menu Items: ${menuItems.map(m => `${m.name} (Category: ${m.category}, Type: ${m.type}, Price: ₹${m.price})`).join(', ')}.
         Your purpose is to assist customers with ordering, answering menu queries, and service requests.
         Be friendly, helpful, and knowledgeable about Indian cuisine.
          When a user asks about menu items, use 'queryMenu' for details.
          When they order, use 'orderFood'.
          When asking for bill, use 'requestBill'. 
          If you call 'requestBill' and the system responds with 'PENDING_ITEMS_DETECTED', you MUST ask the user if they want to cancel those specific pending items. 
          Only if they say "yes" or confirm, call 'requestBill' again with 'confirmCancelPending: true'.
          If the system says items are currently being prepared, you CANNOT cancel them. Simply inform the user the bill is blocked until those items are served.`,
        setAvatarVideoTrack,
        {
          wakeWord: 'Lisa',
          silenceTimeout: 30000,
          avatarId: import.meta.env.VITE_HEYGEN_AVATAR_ID || '8175dfc2-7858-49d6-b5fa-0c135d1c4bad'
        }
      );
      console.log('UI DEBUG: startLiveAgent service returned.');
      // Greeting is now handled proactively within geminiService.ts onopen
    } catch (err: any) {
      console.error('UI ERROR: Failed to start Live Agent (caught in CustomerInterface):', err);
      let errorMessage = 'Failed to start voice agent. Please ensure microphone access and a valid API key.';
      if (err.message && err.message.includes("Requested entity was not found.")) {
        errorMessage = 'API key might be invalid or not selected. Please select your API key (ensure it\'s a paid GCP project).';
        setIsApiKeySelected(false);
      } else if (err.message && err.message.includes("API_KEY_MISSING")) {
        errorMessage = 'API Key is missing. Please ensure it is set up correctly.';
        setIsApiKeySelected(false); // Force re-selection if key is missing
      }
      handleAgentStateChange({ isProcessing: false, error: errorMessage });
      stopLiveAgent(); // Call without argument
      liveSessionRef.current = null;
    }
  }, [isApiKeySelected, handleApiKeySelection, handleSpeechResponse, handleIntent,
    menuItems, cart, addToCart, clearCart, taxRates, placeOrder, sendServiceAlert,
    updateFilteredMenu, setFilteredMenuItems, tableNumber]);

  const stopAgent = useCallback(() => {
    stopLiveAgent(); // Call without argument
    liveSessionRef.current = null;
    hasGreetedRef.current = false; // Reset greeting flag
    setAvatarVideoTrack(null);
    handleAgentStateChange({ isListening: false, isSpeaking: false, isProcessing: false, isAwake: true, currentInputTranscription: '', currentOutputTranscription: '' });
  }, []);

  useEffect(() => {
    // Cleanup on component unmount
    return () => {
      stopAgent();
    };
  }, [stopAgent]);

  const toggleAgent = () => {
    if (agentState.isListening || agentState.isProcessing) {
      stopAgent();
    } else {
      startAgent();
    }
  };

  const menuFilterControls = (
    <div className="flex flex-wrap gap-2 mb-4 p-4 bg-white rounded-lg shadow-sm">
      <Button onClick={() => setFilteredMenuItems(menuItems)} variant="outline" size="sm">
        All
      </Button>
      {Object.values(Category).map(cat => (
        <Button
          key={cat}
          onClick={() => updateFilteredMenu({ category: cat })}
          variant="outline"
          size="sm"
        >
          {cat}
        </Button>
      ))}
      {Object.values(MealType).map(type => (
        <Button
          key={type}
          onClick={() => updateFilteredMenu({ type: type })}
          variant="outline"
          size="sm"
        >
          {type}
        </Button>
      ))}
      <Button
        onClick={() => {
          setFilteredMenuItems(menuItems.filter(item => item.availability));
        }}
        variant="outline"
        size="sm"
      >
        Available
      </Button>
      <input
        type="text"
        placeholder="Search by name..."
        className="p-2 border rounded-md text-sm flex-grow min-w-[150px]"
        onChange={(e) => updateFilteredMenu({ name: e.target.value })}
      />
    </div>
  );


  if (isApiKeySelected === null || (isApiKeySelected === false && !agentState.isProcessing)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gray-50 text-gray-800">
        <h1 className="text-3xl font-bold mb-6">GourmetAI</h1>
        <p className="text-lg text-center mb-8 max-w-md">
          To use GourmetAI, you need to select an API key. Please ensure it's from a paid GCP project for full functionality (especially for Live API).
        </p>
        <Button onClick={handleApiKeySelection} disabled={agentState.isProcessing} className="mb-4">
          {agentState.isProcessing ? 'Opening Key Selector...' : 'Select Your API Key'}
        </Button>
        <p className="text-sm text-center text-gray-600">
          <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
            Billing Documentation
          </a>
        </p>
        {agentState.error && (
          <p className="mt-4 text-red-600 text-center font-medium">{agentState.error}</p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row min-h-screen w-full bg-gray-50 text-gray-800">
      {/* Left Pane: Avatar and Controls */}
      <div className="w-full md:w-1/2 flex flex-col p-4 md:p-6 bg-gradient-to-b from-blue-900 to-blue-800 text-white shadow-2xl sticky top-0 z-20 md:h-screen overflow-y-auto border-b md:border-b-0 md:border-r border-blue-700">
        <div className="flex flex-col items-center py-2 md:py-8">
          <div className="w-full flex items-center justify-between mb-4 md:mb-8 px-2">
            <div className="flex items-center gap-2 md:gap-3">
              <div className="w-8 h-8 md:w-12 md:h-12 bg-white rounded-full flex items-center justify-center text-blue-900 text-lg md:text-2xl font-black shadow-lg">G</div>
              <h1 className="text-xl md:text-5xl font-black tracking-tight drop-shadow-md">GourmetAI</h1>
            </div>
            <div className="flex gap-4 text-xs md:text-sm">
              <a href="#/admin-login" className="text-blue-200 hover:text-white transition-colors">Admin</a>
              <a href="#/kitchen-login" className="text-blue-200 hover:text-white transition-colors">Kitchen</a>
            </div>
          </div>
          <div className="relative group bg-blue-700 p-3 md:p-8 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] flex flex-col items-center w-full max-w-[280px] md:max-w-md border border-blue-600/50 backdrop-blur-sm">
            <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-24 h-24 bg-blue-500 rounded-full blur-[60px] opacity-50 group-hover:opacity-80 transition-opacity"></div>
            <AvatarDisplay
              isListening={agentState.isListening}
              isSpeaking={agentState.isSpeaking}
              error={agentState.error}
              videoTrack={avatarVideoTrack}
            />
            <p className="text-base md:text-lg font-medium mt-3 md:mt-4 text-center">
              {agentState.isProcessing
                ? 'Starting agent...'
                : !agentState.isAwake
                  ? 'Paused. Say "Lisa" to wake me'
                  : agentState.isListening
                    ? 'Listening...'
                    : 'Tap to Speak'}
            </p>
            {agentState.error && (
              <div className="mt-4 flex flex-col items-center">
                <p className="text-red-300 text-center mb-2">{agentState.error}</p>
                {!agentState.isAwake && (
                  <button
                    onClick={() => wakeAgent(handleAgentStateChange)}
                    className="px-6 py-3 bg-green-500 text-white font-bold rounded-full hover:bg-green-600 transition-all transform hover:scale-105 shadow-xl flex items-center gap-3 animate-bounce"
                  >
                    <span className="w-3 h-3 bg-white rounded-full animate-ping"></span>
                    Click to Wake Up Agent
                  </button>
                )}
              </div>
            )}

            {/* Transcription Feed (always visible for debugging) */}
            {(agentState.currentInputTranscription || agentState.currentOutputTranscription) && (
              <div className="mt-6 w-full max-w-md bg-black bg-opacity-30 rounded-lg p-4 text-sm space-y-2 border border-white border-opacity-10">
                {agentState.currentInputTranscription && (
                  <p className="text-gray-300 italic">
                    <span className="text-blue-400 font-bold mr-2">You:</span>
                    {agentState.currentInputTranscription}
                  </p>
                )}
                {agentState.currentOutputTranscription && (
                  <p className="text-gray-300">
                    <span className="text-green-400 font-bold mr-2">Chef:</span>
                    {agentState.currentOutputTranscription}
                  </p>
                )}
              </div>
            )}
            {agentState.currentInputTranscription && (
              <p className="text-sm text-blue-200 mt-2 italic">User: {agentState.currentInputTranscription}</p>
            )}
            {agentState.currentOutputTranscription && (
              <p className="text-sm text-blue-200 mt-1 italic">Avatar: {agentState.currentOutputTranscription}</p>
            )}
            {speechOutput && (
              <p className="text-sm text-blue-200 mt-1 italic">Last message: {speechOutput}</p>
            )}
          </div>
        </div>

        {/* Persistent Controls at the bottom */}
        <div className="p-4 border-t border-blue-700 bg-blue-900/50 backdrop-blur-md sticky bottom-0 z-10 w-full flex flex-col items-center md:flex-row md:justify-around gap-4">
          <div className="flex items-center space-x-2">
            <label htmlFor="tableNumber" className="font-semibold">Table:</label>
            <select
              id="tableNumber"
              className="p-2 rounded-md bg-blue-800 border border-blue-600 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 w-32"
              value={tableNumber}
              onChange={(e) => setTableNumber(e.target.value)}
            >
              {[...Array(totalTables)].map((_, i) => (
                <option key={i + 1} value={`Table ${i + 1}`}>
                  Table {i + 1}
                </option>
              ))}
              <option value="Online">Online</option>
            </select>
          </div>
          <Button
            onClick={toggleAgent}
            className={`w-full md:w-auto px-6 py-3 text-lg transition-all duration-300 ${agentState.isListening ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'
              }`}
            disabled={agentState.isProcessing}
          >
            {agentState.isProcessing
              ? 'Initializing...'
              : agentState.isListening
                ? 'Stop Listening'
                : 'Start Voice Agent'}
          </Button>
          <div className="hidden md:flex flex-col md:ml-4">
            <a href="#/admin-login" className="text-blue-300 hover:text-blue-100 mb-2">Admin Login</a>
            <a href="#/kitchen-login" className="text-blue-300 hover:text-blue-100">Kitchen Login</a>
          </div>
        </div>
      </div>

      {/* Right Pane: Dynamic Menu / Cart / Receipt */}
      <div className="md:w-1/2 flex flex-col p-4 bg-gray-100 overflow-y-auto">
        <div className="flex justify-center mb-4 sticky top-0 bg-gray-100 z-10 p-2 border-b border-gray-200">
          <Button
            onClick={() => setActiveTab('menu')}
            variant={activeTab === 'menu' ? 'primary' : 'secondary'}
            className="mr-2"
          >
            Menu
          </Button>
          <Button
            onClick={() => setActiveTab('cart')}
            variant={activeTab === 'cart' ? 'primary' : 'secondary'}
            className="relative"
          >
            Cart ({cart.reduce((sum, item) => sum + item.quantity, 0)})
          </Button>
          <Button
            onClick={() => setActiveTab('receipt')}
            variant={activeTab === 'receipt' ? 'primary' : 'secondary'}
            className="ml-2"
            disabled={!receipt}
          >
            Receipt
          </Button>
        </div>

        <div className="flex-grow p-4">
          {activeTab === 'menu' && (
            <>
              {menuFilterControls}
              <VisualMenu menuItems={filteredMenuItems} onAddToCart={addToCart} />
            </>
          )}
          {activeTab === 'cart' && (
            <CartDisplay
              cartItems={cart}
              lastSyncTime={lastSyncTime}
              syncStatus={syncStatus}
              onRefresh={refreshData}
              onClearCart={clearCart}
              onRemoveItem={removeFromCart}
              onPlaceOrder={async () => {
                try {
                  const order = await generateBill(tableNumber || 'Online');
                  setReceipt(order);
                  setActiveTab('receipt');
                } catch (error: any) {
                  alert(error.message || 'Failed to generate bill. Please try again.');
                }
              }}
            />
          )}
          {activeTab === 'receipt' && (
            receipt ? <ReceiptDisplay order={receipt} taxRates={taxRates} /> : <p className="text-center text-gray-600">No receipt available yet.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default CustomerInterface;