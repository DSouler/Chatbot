import React, { useState, useEffect, useRef } from 'react';
import {
  Table, Button, Modal, Form, Input, message,
  Card, Select, Space
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined
} from '@ant-design/icons';
import AddUser from './AddUser';
import EditUser from './EditUser';
import GrantPermission from './GrantPermission';
import departments from './example/departments.json';
import users from './example/users.json';

const { Option } = Select;

const ALLOW_USER_MANAGEMENT = false;

const groupOptions = Array.from(new Set(Object.values(departments).flat()));
const initialData = users;

const User = () => {
  const [data, setData] = useState(initialData);
  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState('');
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [grantModalVisible, setGrantModalVisible] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [currentTime, setCurrentTime] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const intervalRef = useRef(null);

  const selectedUsers = data.filter(user => selectedRowKeys.includes(user.key));

  useEffect(() => {
    if (addModalVisible) {
      intervalRef.current = setInterval(() => {
        const now = new Date();
        const formatted = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
        setCurrentTime(formatted);
      }, 1000);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [addModalVisible]);

  const handleAddUser = (values) => {
    const newUser = {
      key: `${Date.now()}`,
      ...values,
      date_created: currentTime,
      last_login_date: currentTime,
    };

    setData(prev => [newUser, ...prev]);
    setAddModalVisible(false);
    message.success('User added');
  };

  const handleEditUser = (updatedUser) => {
    setData(prev =>
      prev.map(user =>
        user.key === updatedUser.key ? updatedUser : user
      )
    );
    setEditModalVisible(false);
    message.success('User updated');
  };

  const handleDelete = (key) => {
    setData(prev => prev.filter(item => item.key !== key));
    message.success("User deleted");
  };

  const handleGrant = (values) => {
    console.log("Granted with:", values);
    message.success("Permissions granted successfully");
    setGrantModalVisible(false);
  };

  const filteredData = data.filter(item =>
    item.name.toLowerCase().includes(search.toLowerCase()) &&
    (groupFilter ? item.department === groupFilter : true)
  );

  const columns = [
    {
      title: 'ID',
      dataIndex: 'index',
      render: (_, __, index) => index + 1,
    },
    { title: 'Name', dataIndex: 'name' },
    { title: 'Email', dataIndex: 'email' },
    { title: 'Department', dataIndex: 'department' },
    { title: 'Position', dataIndex: 'position' },
    {
      title: 'Status',
      dataIndex: 'status',
      render: (text) => (
        <span style={{ color: text === 'Active' ? 'green' : 'red' }}>
          {text}
        </span>
      ),
    },
    { title: 'Date Created', dataIndex: 'date_created' },
    { title: 'Last Login Date', dataIndex: 'last_login_date' },
    {
      title: 'Actions',
      render: (_, record) => (
        <Space>
          {ALLOW_USER_MANAGEMENT && (
            <>
              <Button
                icon={<EditOutlined />}
                size="small"
                onClick={() => {
                  setEditingUser(record);
                  setEditModalVisible(true);
                }}
              >
                Edit
              </Button>
              <Button
                icon={<DeleteOutlined />}
                size="small"
                danger
                onClick={() => handleDelete(record.key)}
              >
                Delete
              </Button>
            </>
          )}
          <Button
            size="small"
            type="primary"
            onClick={() => {
              setSelectedRowKeys([record.key]);
              setGrantModalVisible(true);
            }}
          >
            Grant
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <Card
      title={<span style={{ fontSize: 22, fontWeight: 600 }}>User Management</span>}
      extra={
        <Space>
          <Button
            type="primary"
            disabled={selectedRowKeys.length === 0}
            onClick={() => setGrantModalVisible(true)}
          >
            Grant permission
          </Button>
          {ALLOW_USER_MANAGEMENT && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setAddModalVisible(true)}
            >
              Add User
            </Button>
          )}
        </Space>
      }
      style={{ margin: 24 }}
    >
      <Space style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <Space>
          <Input
            placeholder="Search by Name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 200 }}
          />
          <Select
            placeholder="Filter by Group"
            allowClear
            style={{ width: 200 }}
            value={groupFilter || undefined}
            onChange={(value) => setGroupFilter(value || '')}
          >
            {groupOptions.map(group => (
              <Option key={group} value={group}>{group}</Option>
            ))}
          </Select>
        </Space>

        <Space>
          <span>Total: <strong>{filteredData.length}</strong> users</span>
          <Select
            value={pageSize}
            onChange={(value) => setPageSize(value)}
            style={{ width: 120 }}
          >
            <Option value={5}>5 / page</Option>
            <Option value={10}>10 / page</Option>
            <Option value={20}>20 / page</Option>
            <Option value={50}>50 / page</Option>
          </Select>
        </Space>
      </Space>

      <Table
        rowSelection={{ selectedRowKeys, onChange: setSelectedRowKeys }}
        columns={columns}
        dataSource={filteredData}
        rowKey="key"
        pagination={{ pageSize }}
        bordered
      />

      <AddUser
        visible={addModalVisible}
        onCreate={handleAddUser}
        onCancel={() => setAddModalVisible(false)}
      />

      <EditUser
        visible={editModalVisible}
        user={editingUser}
        onCancel={() => setEditModalVisible(false)}
        onEdit={handleEditUser}
      />

      <GrantPermission
        visible={grantModalVisible}
        onCancel={() => setGrantModalVisible(false)}
        onGrant={handleGrant}
        selectedUsers={selectedUsers}
      />
    </Card>
  );
};

export default User;