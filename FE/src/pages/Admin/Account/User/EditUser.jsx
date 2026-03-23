import React, { useEffect } from 'react';
import { Modal, Form, Input, Select } from 'antd';
import departments from './example/departments.json';

const { Option } = Select;

// Generate dynamic options
const companyOptions = Object.keys(departments); // ['VTI', 'VJP', ...]
const groupOptions = Array.from(new Set(Object.values(departments).flat())); // all departments
const statusOptions = ['Active', 'Blocked'];
const levelOptions = [
  { label: 'Level 0', value: 0 },
  { label: 'Level 1', value: 1 },
  { label: 'Level 2', value: 2 },
  { label: 'Level 3', value: 3 },
  { label: 'Level 4', value: 4 },
];

const EditUser = ({ visible, onCancel, onEdit, user }) => {
  const [form] = Form.useForm();

  useEffect(() => {
    if (visible && user) {
      form.setFieldsValue(user);
    }
  }, [visible, user, form]);

  const handleOk = () => {
    form
      .validateFields()
      .then(values => {
        onEdit({ ...user, ...values });
        form.resetFields();
      })
      .catch(info => {
        console.error('Validate Failed:', info);
      });
  };

  return (
    <Modal
      open={visible}
      title="Edit User"
      okText="Save Changes"
      onCancel={() => {
        form.resetFields();
        onCancel();
      }}
      onOk={handleOk}
    >
      <Form form={form} layout="vertical" name="edit_user_form">
        <Form.Item
          name="name"
          label="Name"
          rules={[{ required: true, message: 'Please input the name!' }]}
        >
          <Input />
        </Form.Item>

        <Form.Item
          name="email"
          label="Email"
          rules={[
            { required: true, message: 'Please input the email!' },
            { type: 'email', message: 'Please enter a valid email!' },
          ]}
        >
          <Input />
        </Form.Item>

        <Form.Item
          name="company"
          label="Company"
          rules={[{ required: true, message: 'Please select a company!' }]}
        >
          <Select placeholder="Select company">
            {companyOptions.map(company => (
              <Option key={company} value={company}>{company}</Option>
            ))}
          </Select>
        </Form.Item>

        <Form.Item
          name="group_user"
          label="Department"
          rules={[{ required: true, message: 'Please select a department!' }]}
        >
          <Select placeholder="Select department">
            {groupOptions.map(group => (
              <Option key={group} value={group}>{group}</Option>
            ))}
          </Select>
        </Form.Item>

        <Form.Item
          name="position"
          label="Position"
          rules={[{ required: true, message: 'Please input the position!' }]}
        >
          <Input />
        </Form.Item>

        <Form.Item
          name="level"
          label="Level"
          rules={[{ required: true, message: 'Please select a level!' }]}
        >
          <Select placeholder="Select level">
            {levelOptions.map(level => (
              <Option key={level.value} value={level.value}>{level.label}</Option>
            ))}
          </Select>
        </Form.Item>

        <Form.Item
          name="status"
          label="Status"
          rules={[{ required: true, message: 'Please select status!' }]}
        >
          <Select placeholder="Select status">
            {statusOptions.map(status => (
              <Option key={status} value={status}>{status}</Option>
            ))}
          </Select>
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default EditUser;
