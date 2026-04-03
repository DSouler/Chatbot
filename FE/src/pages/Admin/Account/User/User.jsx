import React, { useState, useEffect } from 'react';
import {
  Table, Button, Modal, Form, Input, message,
  Card, Select, Space, Tag, Popconfirm, Spin, Switch
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined
} from '@ant-design/icons';
import { adminGetUsers, adminCreateUser, adminUpdateUser, adminDeleteUser, adminUpdateUserStatus } from '../../../../services/auth';

const { Option } = Select;

const User = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [pageSize, setPageSize] = useState(10);

  // Add modal
  const [addVisible, setAddVisible] = useState(false);
  const [addForm] = Form.useForm();
  const [addLoading, setAddLoading] = useState(false);

  // Edit modal
  const [editVisible, setEditVisible] = useState(false);
  const [editForm] = Form.useForm();
  const [editLoading, setEditLoading] = useState(false);
  const [editingUser, setEditingUser] = useState(null);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const users = await adminGetUsers();
      setData(Array.isArray(users) ? users : []);
    } catch (err) {
      message.error('Không thể tải danh sách người dùng');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // ── Create ──
  const handleAdd = async () => {
    try {
      const values = await addForm.validateFields();
      setAddLoading(true);
      await adminCreateUser(values);
      message.success('Tạo người dùng thành công');
      setAddVisible(false);
      addForm.resetFields();
      fetchUsers();
    } catch (err) {
      if (err?.response?.data?.detail) {
        message.error(err.response.data.detail);
      } else if (err?.detail) {
        message.error(err.detail);
      }
    } finally {
      setAddLoading(false);
    }
  };

  // ── Update ──
  const openEdit = (record) => {
    setEditingUser(record);
    editForm.setFieldsValue({
      email: record.email,
      first_name: record.first_name,
      last_name: record.last_name,
      role: record.role,
      password: undefined,
    });
    setEditVisible(true);
  };

  const handleEdit = async () => {
    try {
      const values = await editForm.validateFields();
      const payload = {};
      if (values.email !== undefined && values.email !== editingUser.email) payload.email = values.email;
      if (values.first_name !== undefined) payload.first_name = values.first_name;
      if (values.last_name !== undefined) payload.last_name = values.last_name;
      if (values.role !== undefined) payload.role = values.role;
      if (values.password) payload.password = values.password;

      setEditLoading(true);
      await adminUpdateUser(editingUser.id, payload);
      message.success('Cập nhật thành công');
      setEditVisible(false);
      editForm.resetFields();
      fetchUsers();
    } catch (err) {
      if (err?.response?.data?.detail) {
        message.error(err.response.data.detail);
      } else if (err?.detail) {
        message.error(err.detail);
      }
    } finally {
      setEditLoading(false);
    }
  };

  // ── Delete ──
  const handleDelete = async (userId) => {
    try {
      await adminDeleteUser(userId);
      message.success('Xóa người dùng thành công');
      fetchUsers();
    } catch (err) {
      message.error('Không thể xóa người dùng');
    }
  };

  // ── Toggle Status ──
  const handleStatusToggle = async (userId, currentStatus) => {
    const newStatus = currentStatus === 'active' ? 'blocked' : 'active';
    try {
      await adminUpdateUserStatus(userId, newStatus);
      message.success(newStatus === 'blocked' ? 'Đã khóa tài khoản' : 'Đã mở khóa tài khoản');
      setData(prev => prev.map(u => u.id === userId ? { ...u, status: newStatus } : u));
    } catch (err) {
      message.error('Không thể thay đổi trạng thái');
    }
  };

  // ── Filtering ──
  const filteredData = data.filter(item => {
    const q = search.toLowerCase();
    return (
      (item.username || '').toLowerCase().includes(q) ||
      (item.email || '').toLowerCase().includes(q) ||
      (item.first_name || '').toLowerCase().includes(q) ||
      (item.last_name || '').toLowerCase().includes(q)
    );
  });

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: 'Username', dataIndex: 'username' },
    {
      title: 'Họ tên',
      render: (_, r) => [r.first_name, r.last_name].filter(Boolean).join(' ') || '—',
    },
    { title: 'Email', dataIndex: 'email', render: (v) => v || '—' },
    {
      title: 'Role',
      dataIndex: 'role',
      render: (role) => (
        <Tag color={(role || '').toUpperCase() === 'ADMIN' ? 'red' : 'blue'}>
          {(role || 'USER').toUpperCase()}
        </Tag>
      ),
    },
    {
      title: 'LDAP',
      dataIndex: 'is_ldap_user',
      render: (v) => (v ? <Tag color="green">LDAP</Tag> : <Tag>Local</Tag>),
      width: 80,
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      width: 120,
      render: (status, record) => (
        <Space>
          <Switch
            checked={status !== 'blocked'}
            onChange={() => handleStatusToggle(record.id, status || 'active')}
            checkedChildren="Active"
            unCheckedChildren="Blocked"
            style={{ backgroundColor: status === 'blocked' ? '#ff4d4f' : '#52c41a' }}
          />
        </Space>
      ),
    },
    {
      title: 'Đăng nhập cuối',
      dataIndex: 'last_login',
      render: (v) => v ? new Date(v).toLocaleString('vi-VN') : '—',
    },
    {
      title: 'Ngày tạo',
      dataIndex: 'created_at',
      render: (v) => v ? new Date(v).toLocaleString('vi-VN') : '—',
    },
    {
      title: 'Thao tác',
      width: 160,
      render: (_, record) => (
        <Space>
          <Button icon={<EditOutlined />} size="small" onClick={() => openEdit(record)} />
          <Popconfirm
            title="Xóa người dùng này?"
            description={`Bạn có chắc muốn xóa "${record.username}"?`}
            onConfirm={() => handleDelete(record.id)}
            okText="Xóa"
            cancelText="Hủy"
            okButtonProps={{ danger: true }}
          >
            <Button icon={<DeleteOutlined />} size="small" danger />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Card
      title={<span style={{ fontSize: 22, fontWeight: 600 }}>Quản lý người dùng</span>}
      extra={
        <Space>
          <Button icon={<ReloadOutlined />} onClick={fetchUsers} loading={loading}>
            Làm mới
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setAddVisible(true)}>
            Thêm người dùng
          </Button>
        </Space>
      }
      style={{ margin: 24 }}
    >
      <Space style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <Input
          placeholder="Tìm kiếm theo tên, email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: 300 }}
          allowClear
        />
        <Space>
          <span>Tổng: <strong>{filteredData.length}</strong> người dùng</span>
          <Select value={pageSize} onChange={setPageSize} style={{ width: 120 }}>
            <Option value={5}>5 / trang</Option>
            <Option value={10}>10 / trang</Option>
            <Option value={20}>20 / trang</Option>
            <Option value={50}>50 / trang</Option>
          </Select>
        </Space>
      </Space>

      <Spin spinning={loading}>
        <Table
          columns={columns}
          dataSource={filteredData}
          rowKey="id"
          pagination={{ pageSize }}
          bordered
          size="middle"
        />
      </Spin>

      {/* ── Add User Modal ── */}
      <Modal
        open={addVisible}
        title="Thêm người dùng mới"
        onCancel={() => { setAddVisible(false); addForm.resetFields(); }}
        onOk={handleAdd}
        confirmLoading={addLoading}
        okText="Tạo"
        cancelText="Hủy"
      >
        <Form form={addForm} layout="vertical">
          <Form.Item
            name="username"
            label="Tên đăng nhập"
            rules={[{ required: true, message: 'Vui lòng nhập tên đăng nhập' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="password"
            label="Mật khẩu"
            rules={[
              { required: true, message: 'Vui lòng nhập mật khẩu' },
              { min: 6, message: 'Mật khẩu ít nhất 6 ký tự' },
            ]}
          >
            <Input.Password />
          </Form.Item>
          <Form.Item name="email" label="Email">
            <Input type="email" />
          </Form.Item>
          <Form.Item name="first_name" label="Họ">
            <Input />
          </Form.Item>
          <Form.Item name="last_name" label="Tên">
            <Input />
          </Form.Item>
          <Form.Item name="role" label="Vai trò" initialValue="USER">
            <Select>
              <Option value="USER">USER</Option>
              <Option value="ADMIN">ADMIN</Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* ── Edit User Modal ── */}
      <Modal
        open={editVisible}
        title={`Sửa người dùng: ${editingUser?.username || ''}`}
        onCancel={() => { setEditVisible(false); editForm.resetFields(); }}
        onOk={handleEdit}
        confirmLoading={editLoading}
        okText="Lưu"
        cancelText="Hủy"
      >
        <Form form={editForm} layout="vertical">
          <Form.Item name="email" label="Email">
            <Input type="email" />
          </Form.Item>
          <Form.Item name="first_name" label="Họ">
            <Input />
          </Form.Item>
          <Form.Item name="last_name" label="Tên">
            <Input />
          </Form.Item>
          <Form.Item name="role" label="Vai trò">
            <Select>
              <Option value="USER">USER</Option>
              <Option value="ADMIN">ADMIN</Option>
            </Select>
          </Form.Item>
          <Form.Item name="password" label="Mật khẩu mới (để trống nếu không đổi)">
            <Input.Password />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};

export default User;