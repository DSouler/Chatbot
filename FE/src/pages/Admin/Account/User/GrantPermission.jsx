import React, { useEffect, useState } from 'react';
import {
  Modal,
  Form,
  Checkbox,
  message,
  Slider,
  Tag,
  Space,
  Tooltip,
} from 'antd';
import departments from './example/departments.json';

const companies = Object.keys(departments);

const GrantPermission = ({
  visible,
  onCancel,
  onGrant,
  selectedUsers = [],
}) => {
  const [form] = Form.useForm();
  const [selectedCompanies, setSelectedCompanies] = useState([]);

  const firstUser = selectedUsers[0];
  const userLevel = firstUser?.level ?? 3;
  const userCompany = firstUser?.company ?? companies[0];
  const userDepartment = firstUser?.department ?? '';

  const isSingleUser = selectedUsers.length === 1;

  useEffect(() => {
    if (visible) {
      const initialCompanies = userLevel <= 2 ? [userCompany] : [];
      const initialDepartments =
        userLevel <= 2 ? [`${userCompany}:${userDepartment}`] : [];

      form.setFieldsValue({
        level: userLevel,
        company: initialCompanies,
        department: initialDepartments,
      });

      setSelectedCompanies(initialCompanies);
    } else {
      form.resetFields();
      setSelectedCompanies([]);
    }
  }, [visible]);

  const getAllDepartmentsForCompanies = (companies) => {
    return companies.flatMap((comp) =>
      (departments[comp] || []).map((dep) => `${comp}:${dep}`)
    );
  };

  const handleCompanyChange = (checkedCompanies) => {
    setSelectedCompanies(checkedCompanies);

    // Auto-assign departments only for level 3 or 4
    if (userLevel >= 3) {
      const currentDepartments = form.getFieldValue('department') || [];
      const updatedDepartments = new Set([
        ...currentDepartments,
        ...getAllDepartmentsForCompanies(checkedCompanies),
      ]);

      // Remove departments for unchecked companies
      const filteredDepartments = Array.from(updatedDepartments).filter((d) => {
        const [comp] = d.split(':');
        return checkedCompanies.includes(comp);
      });

      form.setFieldsValue({ department: filteredDepartments });
    } else {
      // For level 0–2, no auto-select
      form.setFieldsValue({ department: [] });
    }
  };

  const handleDepartmentChange = (checkedDepartments) => {
    form.setFieldsValue({ department: checkedDepartments });
  };

const getLevelWarningMessage = (level) => {
  if (level <= 2) {
    return 'You are granting permissions to a low level user. Continue?';
  }
  return '';
};

const handleSubmit = async () => {
  try {
    const values = await form.validateFields();

    if (userLevel >= 3 && Array.isArray(values.department)) {
      values.department = values.department.map((d) => {
        const [company, dept] = d.split(':');
        return { company, department: dept };
      });
    }

    const confirmMessage = isSingleUser
      ? (userLevel <= 2
          ? getLevelWarningMessage(userLevel)
          : '') // no message for level 3/4
      : `You're about to apply permissions to ${selectedUsers.length} users. Continue?`;

    if (!confirmMessage) {
      onGrant(values);
      form.resetFields();
      setSelectedCompanies([]);
      return;
    }

    // Show confirmation dialog
    Modal.confirm({
      title: 'Confirm Permission Update',
      content: confirmMessage,
      okText: 'Confirm',
      cancelText: 'Cancel',
      onOk: () => {
        onGrant(values);
        form.resetFields();
        setSelectedCompanies([]);
      },
    });
  } catch (err) {
    console.error('Validation Failed:', err);
  }
};
  const renderFields = () => (
    <>
      {isSingleUser && (
        <Form.Item label="Level" name="level" rules={[{ required: true }]}>
          <Slider
            min={0}
            max={4}
            marks={{
              0: 'L0',
              1: 'L1',
              2: 'L2',
              3: 'L3',
              4: 'L4',
            }}
            tooltip={{ open: false }}
            disabled
          />
        </Form.Item>
      )}

      <Form.Item label="Company" name="company" rules={[{ required: true }]}>
        <Checkbox.Group
          onChange={handleCompanyChange}
          value={form.getFieldValue('company')}
        >
          {companies.map((comp) => (
            <Checkbox key={comp} value={comp}>
              {comp}
            </Checkbox>
          ))}
        </Checkbox.Group>
      </Form.Item>

      <Form.Item label="Department" name="department" rules={[{ required: true }]}>
        <Checkbox.Group
          onChange={handleDepartmentChange}
          value={form.getFieldValue('department')}
        >
          {selectedCompanies.flatMap((comp) =>
            (departments[comp] || []).map((dep) => {
              const value = `${comp}:${dep}`;
              return (
                <Checkbox key={value} value={value}>
                  {userLevel <= 2 ? dep : `${comp} - ${dep}`}
                </Checkbox>
              );
            })
          )}
        </Checkbox.Group>
      </Form.Item>
    </>
  );

  const renderSelectedUsers = () => {
    const maxDisplay = 3;
    const displayed = selectedUsers.slice(0, maxDisplay);
    const hidden = selectedUsers.slice(maxDisplay);

    return (
      <Space direction="vertical" style={{ marginBottom: 16 }}>
        <div><strong>Selected Users:</strong></div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {displayed.map((user) => (
            <Tag key={user.email}>{user.email}</Tag>
          ))}
          {hidden.length > 0 && (
            <Tooltip
              title={
                <div style={{ maxWidth: 300 }}>
                  {hidden.map((user) => (
                    <div key={user.email}>{user.email}</div>
                  ))}
                </div>
              }
            >
              <Tag color="blue">+{hidden.length} more</Tag>
            </Tooltip>
          )}
        </div>
      </Space>
    );
  };

  return (
    <Modal
      open={visible}
      title="Grant Permission"
      onCancel={onCancel}
      okText="Apply"
      onOk={handleSubmit}
      destroyOnClose
    >
      {renderSelectedUsers()}
      <Form layout="vertical" form={form}>
        {renderFields()}
      </Form>
    </Modal>
  );
};

export default GrantPermission;
