# 🚂 Railway Deployment Guide for Mux Backend

## 📋 **Prerequisites**
- ✅ GitHub account
- ✅ Railway account (sign up at railway.app)
- ✅ Your Mux credentials ready

## 🚀 **Step-by-Step Deployment**

### **1. Push to GitHub**
```bash
# In your main project directory
git add .
git commit -m "Add Mux backend for Railway deployment"
git push origin main
```

### **2. Deploy to Railway**
1. Go to **[railway.app](https://railway.app)**
2. Click **"Start a New Project"**
3. Select **"Deploy from GitHub repo"**
4. Choose your **glint** repository
5. Set **Root Directory** to: `backend`
6. Click **"Deploy"**

### **3. Configure Environment Variables**
In Railway dashboard:
1. Go to your project → **Variables** tab
2. Add these variables:
   ```
   MUX_TOKEN_ID=660383c1-ab86-47b2-846a-7e132dae1545
   MUX_TOKEN_SECRET=Ke3t9JtAS3Qz2boZ6NEflHUbiChZZqNiIGvpqEHBGfQFUC7PfvJxyTtIfUZylLgJO8Je5O4R95Q
   NODE_ENV=production
   ```

### **4. Get Your Railway URL**
After deployment, Railway gives you a URL like:
```
https://your-app-name.railway.app
```

### **5. Update Your React Native App**
Update your app to use the Railway URL instead of localhost.

## 💰 **Railway Pricing**
- **$5/month free credits** (enough for development)
- **$0.000463 per GB-hour** after free tier
- **Automatic scaling** based on usage

## ✅ **Benefits**
- ✅ **No manual server management**
- ✅ **Auto-deployment** from GitHub
- ✅ **Secure environment variables**
- ✅ **Custom domain**
- ✅ **Automatic HTTPS**
- ✅ **Zero-downtime deployments**

## 🔄 **Alternative: One-Click Deploy**
[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new/template?template=https://github.com/railwayapp/examples/tree/main/examples/nodejs)

## 📱 **After Deployment**
Your Mux backend will be available 24/7 at your Railway URL!
No more manual server starting! 🎉
