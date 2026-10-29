# Build stage: compiles the React Vite frontend
FROM node:20-alpine AS build
WORKDIR /repo
COPY . .
RUN npm install --ignore-scripts --no-audit --no-fund
WORKDIR /repo/apps/wind-forecast-check
RUN npx vite build

# Production stage: Nginx serving static files and reverse-proxying /api to backend
FROM nginx:alpine
COPY --from=build /repo/apps/wind-forecast-check/dist /usr/share/nginx/html

RUN printf 'server {\n\
    listen 80;\n\
    location /api/ {\n\
        proxy_pass http://backend:8000/api/;\n\
        proxy_set_header Host $host;\n\
        proxy_set_header X-Real-IP $remote_addr;\n\
    }\n\
    location / {\n\
        root /usr/share/nginx/html;\n\
        try_files $uri /index.html;\n\
    }\n\
}\n' > /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
