// src/components/ShopAssistant.tsx
// Floating "Asistente" button + chat modal for the store, backed by the
// backend's /ai/shop-assistant (Gemini free tier). The button only renders
// when (a) the user is signed in — the endpoint requires a token, and the
// 401 interceptor must never fire for anonymous shoppers — and (b) the
// backend reports quota available (GET /ai/status). When the daily free
// quota runs out mid-chat the backend answers 503 AI_QUOTA_EXHAUSTED and
// the assistant hides itself until the next day's status check.
import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { AuthContext } from '../contexts/AuthContext';
import api from '../api';

interface ChatMsg {
  role: 'user' | 'assistant';
  content: string;
}

export default function ShopAssistant() {
  const { user } = useContext(AuthContext) as any;
  const [available, setAvailable] = useState(false);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const listRef = useRef<FlatList>(null);

  const checkStatus = useCallback(async () => {
    try {
      const res = await api.get('/ai/status');
      setAvailable(Boolean(res.data?.available));
    } catch {
      // Route missing/unreachable → just don't offer the assistant.
      setAvailable(false);
    }
  }, []);

  useEffect(() => {
    if (user) {
      checkStatus();
    }
  }, [user, checkStatus]);

  const quotaExhausted = () => {
    setOpen(false);
    setAvailable(false);
    Alert.alert(
      'Asistente no disponible',
      'El asistente alcanzó su límite por hoy. Estará disponible de nuevo mañana.',
    );
  };

  const send = async () => {
    const text = input.trim();
    if (!text || sending) {
      return;
    }
    const history = messages.slice(-10);
    setMessages(m => [...m, { role: 'user', content: text }]);
    setInput('');
    setNotice(null);
    setSending(true);
    try {
      const res = await api.post('/ai/shop-assistant', { message: text, history });
      const reply = res.data?.reply || 'No tengo una respuesta en este momento.';
      setMessages(m => [...m, { role: 'assistant', content: reply }]);
    } catch (err: any) {
      const status = err?.response?.status;
      const code = err?.response?.data?.code;
      if (status === 503 || code === 'AI_QUOTA_EXHAUSTED') {
        quotaExhausted();
      } else if (status === 429 || code === 'AI_BUSY') {
        setNotice('Hay mucho tráfico. Intenta de nuevo en unos segundos.');
      } else {
        setNotice('No se pudo enviar tu mensaje. Revisa tu conexión.');
      }
    } finally {
      setSending(false);
    }
  };

  if (!user || !available) {
    return null;
  }

  return (
    <>
      <TouchableOpacity
        style={styles.fab}
        onPress={() => {
          setOpen(true);
          checkStatus();
        }}
        testID="shop-assistant-fab"
      >
        <Text style={styles.fabText}>✨ Asistente</Text>
      </TouchableOpacity>

      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Asistente de compras</Text>
            <TouchableOpacity onPress={() => setOpen(false)}>
              <Text style={styles.closeButton}>Cerrar</Text>
            </TouchableOpacity>
          </View>

          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(_, i) => String(i)}
            contentContainerStyle={styles.chatArea}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
            renderItem={({ item }) => (
              <View
                style={[
                  styles.bubble,
                  item.role === 'user' ? styles.bubbleUser : styles.bubbleAssistant,
                ]}
              >
                <Text style={item.role === 'user' ? styles.bubbleUserText : styles.bubbleText}>
                  {item.content}
                </Text>
              </View>
            )}
            ListEmptyComponent={
              <Text style={styles.greeting}>
                Hola 👋 Soy el asistente de Huastex.{'\n'}
                Dime qué buscas — por ejemplo: "un refrigerador para familia
                de 4" o "minisplit para un cuarto pequeño".
              </Text>
            }
          />

          {notice && <Text style={styles.notice}>{notice}</Text>}

          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
          >
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                placeholder="Escribe qué producto buscas…"
                value={input}
                onChangeText={setInput}
                editable={!sending}
                onSubmitEditing={send}
                returnKeyType="send"
                testID="shop-assistant-input"
              />
              <TouchableOpacity
                style={[styles.sendButton, sending && styles.sendButtonDisabled]}
                onPress={send}
                disabled={sending}
                testID="shop-assistant-send"
              >
                {sending ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.sendButtonText}>Enviar</Text>
                )}
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 24,
    backgroundColor: '#1486AC',
    borderRadius: 24,
    paddingVertical: 12,
    paddingHorizontal: 18,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  fabText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  container: {
    flex: 1,
    backgroundColor: '#f3f6fb',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: 50,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  closeButton: {
    color: '#dc3545',
    fontSize: 16,
    fontWeight: '600',
  },
  chatArea: {
    padding: 16,
    paddingBottom: 24,
  },
  greeting: {
    color: '#555',
    fontSize: 15,
    lineHeight: 22,
    marginTop: 12,
  },
  bubble: {
    maxWidth: '85%',
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
  },
  bubbleUser: {
    alignSelf: 'flex-end',
    backgroundColor: '#1486AC',
  },
  bubbleAssistant: {
    alignSelf: 'flex-start',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e3e8ee',
  },
  bubbleText: {
    color: '#222',
    fontSize: 14.5,
    lineHeight: 20,
  },
  bubbleUserText: {
    color: '#fff',
    fontSize: 14.5,
    lineHeight: 20,
  },
  notice: {
    textAlign: 'center',
    color: '#b35c00',
    paddingHorizontal: 16,
    paddingBottom: 6,
    fontSize: 13,
  },
  inputRow: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#ddd',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    backgroundColor: '#fafafa',
    marginRight: 8,
  },
  sendButton: {
    backgroundColor: '#1486AC',
    borderRadius: 20,
    paddingHorizontal: 18,
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#6c757d',
  },
  sendButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
});
