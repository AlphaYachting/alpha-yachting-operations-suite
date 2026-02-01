
import React, { useState, useEffect, useContext, useCallback } from 'react';
import { Card, Button, Spin, Typography, message, Modal, Row, Col, Descriptions, Space, Alert } from 'antd';
import { FilePdfOutlined, EditOutlined, PrinterOutlined } from '@ant-design/icons';
import moment from 'moment';

// Assuming these are custom components or utilities
import PDFExportButton from '../components/PDFExportButton'; // Line 64: Added PDFExportButton import
import PDFViewer from '../components/PDFViewer'; // Assuming a PDFViewer component for modal display

// Assuming some context or API calls
import { WorkOrderContext } from './WorkOrderContext';
import { getWorkOrderDetail, updateWorkOrder } from '../api/workOrders';
import { getPartnerBriefData } from '../api/partners'; // For fetching brief data

const { Title, Text } = Typography;

const WorkOrderDetail = ({ match, history }) => {
    const { workOrderId } = match.params;
    const [loading, setLoading] = useState(true);
    const [workOrderData, setWorkOrderData] = useState(null);
    const [partnerData, setPartnerData] = useState(null);
    const [budgetData, setBudgetData] = useState([]);
    const [tasksData, setTasksData] = useState([]);
    const [error, setError] = useState(null);

    // Line 118: Added state for PDF modal
    const [partnerBriefPdfContent, setPartnerBriefPdfContent] = useState(null);
    const [isPartnerBriefPdfModalVisible, setIsPartnerBriefPdfModalVisible] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                const orderDetail = await getWorkOrderDetail(workOrderId);
                setWorkOrderData(orderDetail);
                // Simulate fetching partner brief data
                const briefData = await getPartnerBriefData(workOrderId);
                setPartnerData(briefData.partner);
                setBudgetData(briefData.budgetItems);
                setTasksData(briefData.tasks);
            } catch (err) {
                setError('Failed to load work order details.');
                message.error('Failed to load work order details.');
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [workOrderId]);

    // Line 328-411: Replaced handleGenerateBrief function with new PDF generation logic

    /**
     * Formats tasks and budget into line items suitable for the PDF document.
     * @returns {Array} An array of formatted line items.
     */
    const getPartnerBriefPDFLineItems = useCallback(() => {
        if (!budgetData || !tasksData) {
            return [];
        }

        const lineItems = [];

        // Add budget items
        budgetData.forEach(item => {
            lineItems.push({
                type: 'budget',
                description: item.description,
                amount: `$${item.amount ? item.amount.toFixed(2) : '0.00'}`,
            });
        });

        // Add tasks
        tasksData.forEach(task => {
            lineItems.push({
                type: 'task',
                description: task.name,
                dueDate: task.dueDate ? moment(task.dueDate).format('YYYY-MM-DD') : 'N/A',
            });
        });

        return lineItems;
    }, [budgetData, tasksData]);

    /**
     * Generates the full PDF document object for the partner brief.
     * This function is intended to be called when the PDF needs to be generated/viewed.
     * @returns {Object|null} The structured PDF document data or null if data is incomplete.
     */
    const getPartnerBriefPDFDocument = useCallback(() => {
        if (!workOrderData || !partnerData || !budgetData || !tasksData) {
            message.error('Data not available for brief generation.');
            return null;
        }

        const briefLineItems = getPartnerBriefPDFLineItems();

        return {
            fileName: `PartnerBrief_${workOrderData.id || 'N/A'}.pdf`,
            document: {
                title: `Partner Brief: ${workOrderData.title || 'Untitled Work Order'}`,
                header: {
                    partnerName: partnerData.name,
                    partnerEmail: partnerData.email,
                    workOrderId: workOrderData.id,
                    workOrderStatus: workOrderData.status,
                    workOrderDueDate: moment(workOrderData.dueDate).format('YYYY-MM-DD'),
                },
                sections: [
                    {
                        title: 'Work Order Overview',
                        content: workOrderData.description || 'No description provided.',
                    },
                    {
                        title: 'Partner Contact Information',
                        type: 'descriptions',
                        data: [
                            { label: 'Name', value: partnerData.name },
                            { label: 'Email', value: partnerData.email },
                            { label: 'Phone', value: partnerData.phone },
                        ],
                    },
                    {
                        title: 'Budget Details',
                        type: 'table',
                        columns: [{ id: 'description', header: 'Item' }, { id: 'amount', header: 'Amount' }],
                        data: briefLineItems.filter(item => item.type === 'budget').map(item => ({
                            description: item.description,
                            amount: item.amount,
                        })),
                    },
                    {
                        title: 'Tasks',
                        type: 'table',
                        columns: [{ id: 'description', header: 'Task Name' }, { id: 'dueDate', header: 'Due Date' }],
                        data: briefLineItems.filter(item => item.type === 'task').map(item => ({
                            description: item.description,
                            dueDate: item.dueDate,
                        })),
                    },
                ],
                footer: {
                    generatedDate: moment().format('YYYY-MM-DD HH:mm'),
                    companyName: 'Your Company Name', // Placeholder
                },
            },
        };
    }, [workOrderData, partnerData, budgetData, tasksData, getPartnerBriefPDFLineItems]);


    const handleViewPartnerBriefPdf = useCallback(() => {
        const briefDoc = getPartnerBriefPDFDocument();
        if (briefDoc) {
            setPartnerBriefPdfContent(briefDoc);
            setIsPartnerBriefPdfModalVisible(true);
        }
    }, [getPartnerBriefPDFDocument]);

    const handleClosePdfModal = useCallback(() => {
        setIsPartnerBriefPdfModalVisible(false);
        setPartnerBriefPdfContent(null);
    }, []);

    if (loading) {
        return <Spin size="large" style={{ display: 'block', margin: '50px auto' }} />;
    }

    if (error) {
        return <Alert message="Error" description={error} type="error" showIcon />;
    }

    if (!workOrderData) {
        return <Alert message="Not Found" description="Work order not found." type="warning" showIcon />;
    }

    return (
        <div style={{ padding: 24 }}>
            <Title level={2}>{workOrderData.title}</Title>
            <Text type="secondary">Work Order ID: {workOrderData.id}</Text>

            <Row gutter={16} style={{ marginTop: 24 }}>
                <Col span={16}>
                    <Card title="Details" extra={<Button icon={<EditOutlined />}>Edit</Button>}>
                        <Descriptions layout="vertical" bordered>
                            <Descriptions.Item label="Description">{workOrderData.description}</Descriptions.Item>
                            <Descriptions.Item label="Status">{workOrderData.status}</Descriptions.Item>
                            <Descriptions.Item label="Due Date">{moment(workOrderData.dueDate).format('YYYY-MM-DD')}</Descriptions.Item>
                            <Descriptions.Item label="Created By">{workOrderData.createdBy}</Descriptions.Item>
                            <Descriptions.Item label="Created At">{moment(workOrderData.createdAt).format('YYYY-MM-DD HH:mm')}</Descriptions.Item>
                        </Descriptions>
                    </Card>

                    <Card title="Tasks" style={{ marginTop: 16 }}>
                        {tasksData.length === 0 ? (
                            <Text>No tasks defined.</Text>
                        ) : (
                            <ul>
                                {tasksData.map((task, index) => (
                                    <li key={index}>{task.name} (Due: {moment(task.dueDate).format('YYYY-MM-DD')})</li>
                                ))}
                            </ul>
                        )}
                    </Card>

                    <Card title="Budget" style={{ marginTop: 16 }}>
                        {budgetData.length === 0 ? (
                            <Text>No budget items defined.</Text>
                        ) : (
                            <ul>
                                {budgetData.map((item, index) => (
                                    <li key={index}>{item.description}: ${item.amount.toFixed(2)}</li>
                                ))}
                            </ul>
                        )}
                    </Card>
                </Col>
                <Col span={8}>
                    <Card title="Actions" style={{ marginBottom: 16 }}>
                        <Space direction="vertical" style={{ width: '100%' }}>
                            <Button type="primary" block>Assign Team</Button>
                            <Button block>Update Status</Button>
                        </Space>
                    </Card>

                    {/* Line 678-728: Replaced TeamOrderCard component with inline Card that uses PDFExportButton */}
                    <Card title="Partner Brief" style={{ marginTop: 16 }}>
                        <PDFExportButton
                            buttonText="View / Export Brief PDF"
                            icon={<FilePdfOutlined />}
                            onClick={handleViewPartnerBriefPdf} // Triggers the modal display in this component
                        />
                        {/* The PDFExportButton here acts as a trigger. The actual modal and viewer are rendered below */}
                    </Card>

                    <Card title="Related Partner" style={{ marginTop: 16 }}>
                        {partnerData ? (
                            <Descriptions column={1}>
                                <Descriptions.Item label="Name">{partnerData.name}</Descriptions.Item>
                                <Descriptions.Item label="Email">{partnerData.email}</Descriptions.Item>
                                <Descriptions.Item label="Phone">{partnerData.phone}</Descriptions.Item>
                            </Descriptions>
                        ) : (
                            <Text>No partner associated.</Text>
                        )}
                    </Card>
                </Col>
            </Row>

            {/* PDF Viewer Modal */}
            <PDFViewer
                visible={isPartnerBriefPdfModalVisible}
                documentData={partnerBriefPdfContent}
                onClose={handleClosePdfModal}
                fileName={partnerBriefPdfContent?.fileName || 'PartnerBrief.pdf'}
            />
        </div>
    );
};

export default WorkOrderDetail;
