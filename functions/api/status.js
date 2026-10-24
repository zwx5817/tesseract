export async function onRequestPost(context) {
    const { request, env } = context;
    
    // 1. 获取前端传来的 Turnstile Token
    let token = '';
    try {
        const body = await request.json();
        token = body.token;
    } catch (e) {
        return new Response(JSON.stringify({ error: 'Bad Request' }), { status: 400 });
    }

    // 2. 从 Cloudflare 环境变量中读取 Secret Key
    const SECRET_KEY = env.TURNSTILE_SECRET_KEY;
    if (!SECRET_KEY) {
        return new Response(JSON.stringify({ error: 'Server misconfigured: missing secret key' }), { status: 500 });
    }

    // 3. 去 Cloudflare 验证 Token 的真实性
    const formData = new FormData();
    formData.append('secret', SECRET_KEY);
    formData.append('response', token);

    const verifyRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        body: formData
    });
    const verifyData = await verifyRes.json();

    // 4. 如果人机验证失败，直接踢回去，绝不查服务器
    if (!verifyData.success) {
        return new Response(JSON.stringify({ error: 'Human verification failed' }), { status: 403 });
    }

    // 5. 验证通过，后端悄悄去查 MC 服务器状态（前端全程不知道这两个 API 地址）
    try {
        const [mainRes, smallRes] = await Promise.all([
            fetch('https://api.mcstatus.io/v2/status/java/hmfree.tooo.top:20049'),
            fetch('https://api.mcstatus.io/v2/status/java/play.simpfun.cn:28381')
        ]);
        
        const mainData = await mainRes.json();
        const smallData = await smallRes.json();

        // 6. 把数据返回给前端
        return new Response(JSON.stringify({ main: mainData, small: smallData }), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (e) {
        return new Response(JSON.stringify({ error: 'Upstream API error' }), { status: 502 });
    }
}