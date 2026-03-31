import {useCallback, useEffect, useState} from 'react'
import {
  Card,
  Button,
  Text,
  Spinner,
  Box,
  Stack,
  Heading,
  Badge,
  Inline,
} from '@sanity/ui'
import {useClient} from 'sanity'
import {PublishIcon} from '@sanity/icons'
import {useTheme} from '@sanity/ui'

export function PublishTool() {
  const client = useClient()
  const theme = useTheme()
  const isDark = theme.name === 'studio-dark'
  const [drafts, setDrafts] = useState<any[]>([])
  const [publishedDrafts, setPublishedDrafts] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'success' | 'error' | 'info' | 'loading'>('info')

  // Obtener borradores
  const fetchDrafts = useCallback(async () => {
    try {
      setLoading(true)
      const result = await client.fetch(`*[_id in path("drafts.**")]`)
      setDrafts(result)

      // Identificar cuáles borradores ya tienen versión publicada
      if (result.length > 0) {
        const publishedIds = result.map((draft) => draft._id.replace('drafts.', ''))
        const publishedCheck = await client.fetch(
          `*[_id in $ids]`,
          {ids: publishedIds}
        )

        // Drafts que tienen versión publicada
        const published = result.filter((draft) => {
          const publishedId = draft._id.replace('drafts.', '')
          return publishedCheck.some((p) => p._id === publishedId)
        })
        setPublishedDrafts(published)
      }
    } catch (error) {
      setMessageType('error')
      setMessage('Error al obtener borradores')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }, [client])

  // Publicar todos los borradores
  const handlePublishAll = useCallback(async () => {
    if (drafts.length === 0) {
      setMessageType('info')
      setMessage('No hay borradores para publicar')
      return
    }

    try {
      setPublishing(true)
      setMessageType('loading')
      setMessage('Publicando...')

      // Crear mutaciones
      const mutations = drafts.map((draft) => {
        const {_id, _rev, _createdAt, _updatedAt, ...cleanDraft} = draft

        return {
          createIfNotExists: {
            ...cleanDraft,
            _id: _id.replace('drafts.', ''),
          },
        }
      })

      // Ejecutar mutaciones
      await client.mutate(mutations)

      setMessageType('success')
      setMessage(`✅ ${drafts.length} documentos publicados exitosamente`)
      setDrafts([])

      // Refrescar después de 2 segundos
      setTimeout(() => fetchDrafts(), 2000)
    } catch (error) {
      setMessageType('error')
      setMessage(`${error instanceof Error ? error.message : 'Unknown error'}`)
      console.error(error)
    } finally {
      setPublishing(false)
    }
  }, [drafts, client, fetchDrafts])

  // Eliminar borradores que ya están publicados
  const handleDeletePublished = useCallback(async () => {
    if (publishedDrafts.length === 0) {
      setMessageType('info')
      setMessage('No hay borradores publicados para eliminar')
      return
    }

    try {
      setDeleting(true)
      setMessageType('loading')
      setMessage('Eliminando borradores publicados...')

      // Eliminar cada borrador por separado
      for (const draft of publishedDrafts) {
        await client.delete(draft._id)
      }

      setMessageType('success')
      setMessage(`✅ ${publishedDrafts.length} borradores eliminados exitosamente`)
      setPublishedDrafts([])

      // Refrescar después de 2 segundos
      setTimeout(() => fetchDrafts(), 2000)
    } catch (error) {
      setMessageType('error')
      setMessage(`${error instanceof Error ? error.message : 'Unknown error'}`)
      console.error(error)
    } finally {
      setDeleting(false)
    }
  }, [publishedDrafts, client, fetchDrafts])

  // Cargar borradores al montar
  useEffect(() => {
    fetchDrafts()
    // Refrescar cada 30 segundos
    const interval = setInterval(fetchDrafts, 30000)
    return () => clearInterval(interval)
  }, [fetchDrafts])

  const getMessageColor = () => {
    switch (messageType) {
      case 'success':
        return isDark ? '#1e3a1f' : '#dcfce7'
      case 'error':
        return isDark ? '#3f1f1f' : '#fee2e2'
      case 'loading':
        return isDark ? '#1f2d3f' : '#dbeafe'
      default:
        return isDark ? '#262626' : '#f5f5f5'
    }
  }

  const getMessageBorder = () => {
    switch (messageType) {
      case 'success':
        return isDark ? '1px solid #4b7c4e' : '1px solid #86efac'
      case 'error':
        return isDark ? '1px solid #7c4b4b' : '1px solid #fca5a5'
      case 'loading':
        return isDark ? '1px solid #4b5f7c' : '1px solid #93c5fd'
      default:
        return isDark ? '1px solid #404040' : '1px solid #e5e5e5'
    }
  }

  const getMessageTextColor = () => {
    switch (messageType) {
      case 'success':
        return isDark ? '#86efac' : '#166534'
      case 'error':
        return isDark ? '#fca5a5' : '#7f1d1d'
      case 'loading':
        return isDark ? '#93c5fd' : '#1e40af'
      default:
        return isDark ? '#a0a0a0' : '#1f2937'
    }
  }

  return (
    <Box padding={4}>
      <Stack space={4}>
        {/* Header */}
        <Card
          padding={4}
          shadow={1}
          radius={2}
          style={{
            background: isDark
              ? 'linear-gradient(135deg, #4c1d95 0%, #312e81 100%)'
              : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          }}
        >
          <Stack space={3}>
            <Inline space={2} style={{alignItems: 'center'}}>
              <div style={{fontSize: '28px'}}>📦</div>
              <Heading as="h1" size={2} style={{color: 'white', margin: 0}}>
                Bulk Publish
              </Heading>
            </Inline>
            <Text size={2} style={{color: isDark ? 'rgba(255, 255, 255, 0.85)' : 'rgba(255, 255, 255, 0.9)'}}>
              Publica todos tus borradores de una vez
            </Text>
          </Stack>
        </Card>

        {/* Status Card */}
        <Card
          padding={3}
          shadow={1}
          radius={2}
          style={{
            background: isDark ? '#1f1f1f' : '#fafafa',
            border: isDark ? '1px solid #404040' : '1px solid #e5e5e5',
          }}
        >
          <Stack space={2}>
            <Inline space={2} style={{alignItems: 'center'}}>
              {loading ? <Spinner /> : <div style={{fontSize: '20px'}}>📋</div>}
              <Text weight="semibold" size={1} style={{color: isDark ? '#e5e5e5' : '#1f2937'}}>
                Estado de Borradores
              </Text>
            </Inline>
            <Inline space={2} style={{alignItems: 'center'}}>
              <Badge
                mode={drafts.length > 0 ? 'default' : 'outline'}
                tone={drafts.length > 0 ? 'primary' : 'default'}
              >
                {loading ? 'Cargando...' : `${drafts.length} borrador${drafts.length !== 1 ? 's' : ''}`}
              </Badge>
              {drafts.length > 0 && !loading && (
                <Text size={0} style={{color: isDark ? '#a0a0a0' : '#6b7280'}}>
                  Listos para publicar
                </Text>
              )}
            </Inline>
          </Stack>
        </Card>

        {/* Publish Button */}
        <Button
          onClick={handlePublishAll}
          disabled={drafts.length === 0 || loading || publishing}
          mode={drafts.length > 0 ? 'default' : 'disabled'}
          tone={drafts.length > 0 ? 'primary' : 'default'}
          icon={publishing ? undefined : PublishIcon}
          text={
            publishing
              ? 'Publicando...'
              : drafts.length > 0
                ? `Publicar ${drafts.length} ${drafts.length === 1 ? 'borrador' : 'borradores'}`
                : 'No hay borradores'
          }
          style={{
            width: '100%',
            minHeight: '56px',
            fontSize: '16px',
            fontWeight: 500,
          }}
        />

        {/* Delete Published Drafts Button */}
        {publishedDrafts.length > 0 && (
          <Button
            onClick={handleDeletePublished}
            disabled={deleting || loading}
            mode="ghost"
            tone="critical"
            text={
              deleting
                ? 'Eliminando...'
                : `Eliminar ${publishedDrafts.length} borrador${publishedDrafts.length !== 1 ? 's' : ''} publicado${publishedDrafts.length !== 1 ? 's' : ''}`
            }
            style={{
              width: '100%',
              minHeight: '48px',
              fontSize: '14px',
            }}
          />
        )}

        {/* Message */}
        {message && (
          <Card
            padding={3}
            radius={2}
            style={{
              background: getMessageColor(),
              border: getMessageBorder(),
            }}
          >
            <Inline space={2} style={{alignItems: 'center'}}>
              {messageType === 'success' && <div style={{fontSize: '20px'}}>✅</div>}
              {messageType === 'error' && <div style={{fontSize: '20px'}}>❌</div>}
              {messageType === 'loading' && <Spinner />}
              <Text size={1} style={{color: getMessageTextColor()}}>
                {message}
              </Text>
            </Inline>
          </Card>
        )}

        {/* Draft List */}
        {drafts.length > 0 && (
          <Card
            padding={3}
            shadow={1}
            radius={2}
            style={{
              background: isDark ? '#1f1f1f' : '#f9fafb',
              border: isDark ? '1px solid #404040' : '1px solid #e5e5e5',
            }}
          >
            <Stack space={2}>
              <Inline space={2} style={{alignItems: 'center'}}>
                <div style={{fontSize: '18px'}}>📄</div>
                <Text weight="semibold" size={1} style={{color: isDark ? '#e5e5e5' : '#1f2937'}}>
                  Documentos a publicar
                </Text>
              </Inline>
              <Box
                style={{
                  maxHeight: '240px',
                  overflow: 'auto',
                  paddingRight: '8px',
                  borderLeft: isDark ? '3px solid #8b5cf6' : '3px solid #667eea',
                  paddingLeft: '12px',
                }}
              >
                <Stack space={1}>
                  {drafts.map((draft) => (
                    <Inline
                      key={draft._id}
                      space={2}
                      style={{
                        alignItems: 'center',
                        paddingBottom: '8px',
                        borderBottom: isDark ? '1px solid #404040' : '1px solid #e5e5e5',
                      }}
                    >
                      <Text
                        size={0}
                        style={{
                          color: isDark ? '#8b5cf6' : '#667eea',
                          fontWeight: 600,
                        }}
                      >
                        ✓
                      </Text>
                      <Text size={0} weight="medium" style={{color: isDark ? '#d4d4d4' : '#1f2937'}}>
                        {draft.name || draft.title || draft._type}
                      </Text>
                      {draft.category && (
                        <div
                          style={{
                            display: 'inline-block',
                            padding: '6px 12px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: 500,
                            backgroundColor: isDark ? '#4c1d95' : '#ede9fe',
                            color: isDark ? '#e9d5ff' : '#6d28d9',
                            border: isDark ? '1px solid #7c3aed' : '1px solid #c4b5fd',
                            whiteSpace: 'nowrap',
                            letterSpacing: '0.5px',
                          }}
                        >
                          {draft.category}
                        </div>
                      )}
                      {publishedDrafts.some((p) => p._id === draft._id) && (
                        <div
                          style={{
                            display: 'inline-block',
                            padding: '4px 8px',
                            borderRadius: '3px',
                            fontSize: '10px',
                            fontWeight: 600,
                            backgroundColor: isDark ? '#3d2200' : '#fed7aa',
                            color: isDark ? '#fcd34d' : '#92400e',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                          }}
                        >
                          📌 Publicado
                        </div>
                      )}
                    </Inline>
                  ))}
                </Stack>
              </Box>
            </Stack>
          </Card>
        )}

        {/* Refresh Info */}
        {drafts.length === 0 && !loading && (
          <Card
            padding={3}
            radius={2}
            style={{
              background: isDark ? '#1e3a3a' : '#eff6ff',
              border: isDark ? '1px solid #3a5f5f' : '1px solid #bfdbfe',
            }}
            tone="primary"
          >
            <Stack space={2}>
              <Inline space={2} style={{alignItems: 'center'}}>
                <div style={{fontSize: '18px'}}>🔄</div>
                <Text size={0} style={{color: isDark ? '#7dd3fc' : '#0369a1'}}>
                  Los borradores se verifican cada 30 segundos automáticamente
                </Text>
              </Inline>
            </Stack>
          </Card>
        )}
      </Stack>
    </Box>
  )
}
