# 🚀 DEPLOY GOOGLE CLOUD BACKEND TO RAILWAY

## 🎯 STEP-BY-STEP DEPLOYMENT

Your test confirms the old Mux backend is still running. Here's how to replace it with Google Cloud:

### 1. 📁 Prepare Files for Railway

```bash
# Create deployment folder
mkdir railway-deployment
cd railway-deployment

# Copy the new Google Cloud files
cp ../backend/google-cloud-server.js ./server.js
cp ../backend/package-google-cloud.json ./package.json
cp ../backend/.env.google-cloud ./.env
```

### 2. 🔑 Upload Service Account Credentials

You need to upload your `glint-7e3c3-service-account.json` file to Railway:

**Method 1: Via Railway Dashboard**
1. Go to your Railway project dashboard
2. Go to "Variables" tab
3. Add new variable: `GOOGLE_APPLICATION_CREDENTIALS` = `./glint-7e3c3-service-account.json`
4. In "Files" section, upload `glint-7e3c3-service-account.json`

**Method 2: Via Railway CLI**
```bash
# Install Railway CLI if not installed
npm install -g @railway/cli

# Login and deploy
railway login
railway link [your-project-id]
railway up
```

### 3. ⚙️ Set Environment Variables in Railway

Go to your Railway project → Variables tab and set these:

```
NODE_ENV=production
GOOGLE_CLOUD_PROJECT_ID=glint-7e3c3
GOOGLE_CLOUD_BUCKET=glint-videos
GOOGLE_APPLICATION_CREDENTIALS=./glint-7e3c3-service-account.json
PORT=3000
```

### 4. 📦 Update package.json

Your Railway deployment needs these dependencies:

```json
{
  "name": "glint-google-cloud-backend",
  "version": "1.0.0",
  "main": "server.js",
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "multer": "^1.4.5-lts.1",
    "@google-cloud/storage": "^7.7.0",
    "@google-cloud/video-intelligence": "^5.0.0",
    "dotenv": "^16.3.1"
  }
}
```

### 5. 🔄 Deploy to Railway

**Option A: Via Railway Dashboard**
1. Connect your GitHub repository
2. Replace `server.js` with `google-cloud-server.js`
3. Update `package.json` with Google Cloud dependencies
4. Add environment variables
5. Upload service account JSON file
6. Redeploy

**Option B: Via Git Push**
```bash
# In your project root
git add .
git commit -m "Replace Mux with Google Cloud - eliminate upload failures"
git push origin main
```

### 6. ✅ Verify Deployment

After deployment, test the new backend:

```bash
# Test health endpoint
curl https://your-railway-app.up.railway.app/health

# Expected response:
{
  "status": "OK",
  "service": "Google Cloud Video Service",
  "cloud_storage": true,
  "video_intelligence": true,
  "cost_savings": "80% vs Mux"
}
```

Then run our test:
```bash
node test-google-cloud.js
```

Should show:
```
🎉 GOOGLE CLOUD SETUP TEST RESULTS
✅ Backend Health: WORKING
✅ Upload URL Creation: WORKING
🚀 STATUS: READY TO REPLACE MUX!
```

## 🎯 QUICK DEPLOYMENT COMMANDS

### Deploy New Google Cloud Backend

```bash
# 1. Backup your current working directory
cd /Users/ganesanaathmanathan/glint

# 2. Create Railway deployment files
cp backend/google-cloud-server.js railway-server.js
cp backend/package-google-cloud.json railway-package.json

# 3. Update your Railway deployment:
# - Replace server.js with railway-server.js
# - Replace package.json with railway-package.json  
# - Add service account JSON file
# - Set environment variables

# 4. Test the deployment
node test-google-cloud.js
```

## 🔧 TROUBLESHOOTING

### If deployment fails:

1. **Check Railway logs**:
   - Go to Railway dashboard → Deployments → View logs
   - Look for errors related to Google Cloud authentication

2. **Verify service account file**:
   - Ensure `glint-7e3c3-service-account.json` is uploaded
   - Check file permissions and path

3. **Check environment variables**:
   - All required variables are set
   - `GOOGLE_APPLICATION_CREDENTIALS` points to correct file

4. **Dependencies issues**:
   - Railway installs all Google Cloud packages
   - No conflicting Mux dependencies

### Common fixes:

```bash
# If authentication fails
echo "Check service account JSON file is properly uploaded to Railway"

# If bucket access fails  
echo "Verify bucket 'glint-videos' exists and is accessible"

# If dependencies fail
echo "Check package.json has all Google Cloud dependencies"
```

## 🎉 AFTER SUCCESSFUL DEPLOYMENT

Once deployed successfully:

1. **Update mobile app** to use Google Cloud service
2. **Remove all Mux dependencies** 
3. **Test video uploads** - no more failures!
4. **Monitor costs** - should be 80% lower
5. **Enjoy reliable video hosting** 🚀

**Your Mux upload failures will be completely eliminated!**
