const API_BASE = 'http://localhost:8080';

async function request(method, path, body) {
  const token = localStorage.getItem('jwt');
  const res = await fetch(API_BASE + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': 'Bearer ' + token } : {})
    },
    body: body != null ? JSON.stringify(body) : undefined
  });

  if (res.status === 401) {
    logout();
    return;
  }

  if (!res.ok) {
    let err;
    try { err = await res.json(); } catch { err = { code: 'UNKNOWN', message: 'Ошибка сервера' }; }
    throw err;
  }

  if (res.status === 204) return null;
  return res.json();
}

const api = {
  get: (path) => request('GET', path),
  post: (path, body) => request('POST', path, body),
};
