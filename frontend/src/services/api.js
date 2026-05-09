import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
  timeout: 8000,
})

api.interceptors.request.use(config => {
  const token = localStorage.getItem('access_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

let isRefreshing = false
let failedQueue  = []

const processQueue = (error, token = null) => {
  failedQueue.forEach(p => error ? p.reject(error) : p.resolve(token))
  failedQueue = []
}

api.interceptors.response.use(
  res => res,
  async err => {
    const original = err.config
    if (err.response?.status === 401 && !original._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        }).then(token => {
          original.headers.Authorization = `Bearer ${token}`
          return api(original)
        })
      }

      original._retry = true
      isRefreshing    = true

      const refresh = localStorage.getItem('refresh_token')
      if (!refresh) {
        localStorage.clear()
        window.location.href = '/login'
        return Promise.reject(err)
      }

      try {
        const { data } = await axios.post('/api/auth/token/refresh/', { refresh })
        localStorage.setItem('access_token', data.access)
        api.defaults.headers.common.Authorization = `Bearer ${data.access}`
        processQueue(null, data.access)
        return api(original)
      } catch (refreshErr) {
        processQueue(refreshErr, null)
        localStorage.clear()
        window.location.href = '/login'
        return Promise.reject(refreshErr)
      } finally {
        isRefreshing = false
      }
    }
    return Promise.reject(err)
  }
)

export const authApi = {
  login:          (credentials) => api.post('/auth/login/', credentials),
  register:       (data)        => api.post('/auth/register/', data),
  me:             ()            => api.get('/auth/me/'),
  updateMe:       (data)        => api.patch('/auth/me/', data),
  progress:       ()            => api.get('/auth/progress/'),
  updateProgress: (id, data)    => api.post(`/auth/progress/${id}/`, data),
  toggleBookmark: (id)          => api.post(`/auth/bookmark/${id}/`),
  bookmarks:      ()            => api.get('/auth/bookmarks/'),
  videoState:     (id)          => api.get(`/auth/video-state/${id}/`),
  activity:       ()            => api.get('/auth/activity/'),
  toggleComplete: (id)          => api.post(`/auth/complete/${id}/`),
  isCompleted:    (id)          => api.get(`/auth/complete/${id}/`),
}

export const resourcesApi = {
  list:       (params)                  => api.get('/resources/', { params }),
  detail:     (id)                      => api.get(`/resources/${id}/`),
  create:     (data, onUploadProgress)  => api.post('/resources/create/', data, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 0,
    onUploadProgress,
  }),
  update:     (id, data, onUploadProgress) => api.patch(`/resources/${id}/update/`, data, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 0,
    onUploadProgress,
  }),
  delete:     (id) => api.delete(`/resources/${id}/delete/`),
  validate:   (id) => api.post(`/resources/${id}/validate/`),
  search:     (params) => api.get('/resources/search/', { params }),
  suggest:    (q)      => api.get('/resources/suggest/', { params: { q } }),
  fileBlob:   (id)     => api.get(`/resources/${id}/file/`, { responseType: 'blob', timeout: 0 }),
  popular:    ()       => api.get('/resources/popular/'),
  recent:     ()       => api.get('/resources/recent/'),
  categories: ()       => api.get('/resources/categories/'),
}

export const recommendationsApi = {
  get:      (n = 12) => api.get('/recommendations/', { params: { n } }),
  sections: ()       => api.get('/recommendations/sections/'),
}

export const contextApi = {
  logNetwork:     (data) => api.post('/context/network/', data),
  logInteraction: (data) => api.post('/context/interactions/', data),
  getZone:        ()     => api.get('/context/zone/'),
  updateZone:     (zone) => api.post('/context/zone/', { zone }),
}

export const feedbackApi = {
  rate:             (id, score)  => api.post(`/feedback/rate/${id}/`, { score }),
  removeRating:     (id)         => api.delete(`/feedback/rate/${id}/`),
  comments:         (id)         => api.get(`/feedback/comments/${id}/`),
  addComment:       (id, text)   => api.post(`/feedback/comments/${id}/`, { text }),
  updateComment:    (cid, text)  => api.patch(`/feedback/comments/edit/${cid}/`, { text }),
  deleteComment:    (cid)        => api.delete(`/feedback/comments/edit/${cid}/`),
  suggest:          (data)       => api.post('/feedback/suggestions/', data),
  suggestions:      ()           => api.get('/feedback/suggestions/'),
  reviewSuggestion: (id)         => api.patch(`/feedback/suggestions/${id}/review/`),
}

export const llmApi = {
  status:          ()          => api.get('/llm/status/'),
  summarize:       (id, level) => api.get(`/llm/summarize/${id}/`, { params: level ? { level } : {} }),
  detailedSummary: (id, level) => api.get(`/llm/detailed-summary/${id}/`, { params: level ? { level } : {}, timeout: 120000 }),
  simplify:        (id, level) => api.get(`/llm/simplify/${id}/`, { params: { level } }),
  variants:        (id)        => api.get(`/llm/variants/${id}/`),
  simpler:         (id)        => api.get(`/llm/simpler/${id}/`, { timeout: 120000 }),
  learningPath:    ()          => api.get('/llm/learning-path/'),
  videoStatus:     (id)        => api.get(`/llm/video/${id}/`),
  generateVideo:   (id)        => api.post(`/llm/video/${id}/generate/`, {}, { timeout: 30000 }),
}

export const dashboardApi = {
  overview:  ()       => api.get('/dashboard/overview/'),
  usage:     (params) => api.get('/dashboard/usage/', { params }),
  students:  ()       => api.get('/dashboard/students/'),
  resources: ()       => api.get('/dashboard/resources/'),
  network:   ()       => api.get('/dashboard/network/'),
}

export default api
