import React from 'react';
import { Result, Button } from 'antd';
import { useNavigate } from 'react-router-dom';

export default function RegisterPage() {
  const navigate = useNavigate();
  return (
    <div style={{ padding: 60 }}>
      <Result
        title="注册功能暂未开放"
        subTitle="请联系管理员开通账号"
        extra={
          <Button type="primary" onClick={() => navigate('/login')}>
            返回登录
          </Button>
        }
      />
    </div>
  );
}
