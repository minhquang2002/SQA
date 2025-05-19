const { fGetRecentChat, fGetMessageByVNUId, fGetRecentContact } = require('./chat');
const mongoose = require('mongoose');

// Mock Constants
jest.mock('./../../configs/Constants', () => ({
  RES_FORM: (status, data) => ({ status, data })
}));

// Mock DB Models
const mockChat = {
  find: jest.fn(),
  findOne: jest.fn()
};
const mockUser = {
  findOne: jest.fn()
};
const mockMessage = {
  findOne: jest.fn()
};
global.DBConnection = {
  Chat: mockChat,
  User: mockUser,
  Message: mockMessage
};

describe('Chat Functions', () => {
  let req, res, senderId, otherId;

  beforeEach(() => {
    jest.clearAllMocks();

    senderId = new mongoose.Types.ObjectId();
    otherId = new mongoose.Types.ObjectId();

    req = {
      senderInstance: { _id: senderId },
      params: {}
    };
    res = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
      json: jest.fn()
    };
  });

  describe('fGetRecentChat', () => {
    // Chat01
    it('should return sorted chat rooms by latest message date', async () => {
      const chatRooms = [
        { _id: 'room1', membersID: [senderId, otherId], messages: [{ _id: 'msg1', createdAt: new Date('2023-10-02') }] },
        { _id: 'room2', membersID: [senderId, otherId], messages: [{ _id: 'msg2', createdAt: new Date('2023-10-01') }] }
      ];
      mockChat.find.mockReturnValue({
        populate: jest.fn().mockResolvedValue(chatRooms)
      });

      await fGetRecentChat(req, res);

      console.log('Test: should return sorted chat rooms by latest message date');
      console.log('Expected Output:', JSON.stringify({ status: 'Success', data: chatRooms }, null, 2));
      console.log('Actual Output:', JSON.stringify(res.send.mock.calls[0][0], null, 2));

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith({ status: 'Success', data: chatRooms });
      // Kiểm tra xem truy vấn có chứa senderId
      expect(mockChat.find).toHaveBeenCalledWith({ membersID: { $all: [senderId] } });
    });
    // Chat02
    it('should return empty array if no chat rooms', async () => {
      mockChat.find.mockReturnValue({
        populate: jest.fn().mockResolvedValue([])
      });

      await fGetRecentChat(req, res);

      console.log('Test: should return empty array if no chat rooms');
      console.log('Expected Output:', JSON.stringify({ status: 'Success', data: [] }, null, 2));
      console.log('Actual Output:', JSON.stringify(res.send.mock.calls[0][0], null, 2));

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith({ status: 'Success', data: [] });
    });


  });

  describe('fGetMessageByVNUId', () => {
    // Chat03
    it('should return messages for valid otherVNUId', async () => {
      req.params.otherVNUId = 'vnu123';
      const otherUser = { _id: otherId, vnu_id: 'vnu123' };
      const chatRoom = {
        membersID: [senderId, otherId],
        messages: [
          { _id: 'msg1', from: senderId, to: otherId },
          { _id: 'msg2', from: otherId, to: senderId }
        ]
      };

      mockUser.findOne.mockResolvedValue(otherUser);
      mockChat.findOne.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue(chatRoom)
        })
      });

      await fGetMessageByVNUId(req, res);

      console.log('Test: should return messages for valid otherVNUId');
      console.log('Expected Output:', JSON.stringify({ status: 'Success', data: chatRoom.messages }, null, 2));
      console.log('Actual Output:', JSON.stringify(res.send.mock.calls[0][0], null, 2));

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith({ status: 'Success', data: chatRoom.messages });
      expect(mockChat.findOne).toHaveBeenCalledWith({ membersID: { $size: 2, $all: [senderId, otherId] } });
      expect(chatRoom.messages).toEqual(expect.arrayContaining([
        expect.objectContaining({ _id: 'msg1', from: senderId, to: otherId }),
        expect.objectContaining({ _id: 'msg2', from: otherId, to: senderId })
      ]));
    });
    // Chat04
    it('should return empty array if no chat room', async () => {
      req.params.otherVNUId = 'vnu123';
      const otherUser = { _id: otherId, vnu_id: 'vnu123' };

      mockUser.findOne.mockResolvedValue(otherUser);
      mockChat.findOne.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue(null)
        })
      });

      await fGetMessageByVNUId(req, res);

      console.log('Test: should return empty array if no chat room');
      console.log('Expected Output:', JSON.stringify({ status: 'Success', data: [] }, null, 2));
      console.log('Actual Output:', JSON.stringify(res.send.mock.calls[0][0], null, 2));

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith({ status: 'Success', data: [] });
    });
    // Chat05
    it('should return error for invalid otherVNUId', async () => {
      req.params.otherVNUId = 'invalid';
      mockUser.findOne.mockResolvedValue(null);

      await fGetMessageByVNUId(req, res);

      console.log('Test: should return error for invalid otherVNUId');
      console.log('Expected Output:', JSON.stringify({ status: 'Error', data: 'Không tìm thấy đối tượng cần xem tin nhắn' }, null, 2));
      console.log('Actual Output:', JSON.stringify(res.json.mock.calls[0][0], null, 2));

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ status: 'Error', data: 'Không tìm thấy đối tượng cần xem tin nhắn' });
    });
    // Chat06
    it('should handle empty or invalid otherVNUId', async () => {
      req.params.otherVNUId = '';

      await fGetMessageByVNUId(req, res);

      console.log('Test: should return error for empty otherVNUId');
      console.log('Expected Output:', JSON.stringify({ status: 'Error', data: 'Không tìm thấy đối tượng cần xem tin nhắn' }, null, 2));
      console.log('Actual Output:', JSON.stringify(res.json.mock.calls[0][0], null, 2));

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ status: 'Error', data: 'Không tìm thấy đối tượng cần xem tin nhắn' });
    });
  });

  describe('fGetRecentContact', () => {
    // Chat07
    it('should return contacts with latest message and sender status', async () => {
      const chatRooms = [
        {
          _id: new mongoose.Types.ObjectId(),
          membersID: [
            { _id: senderId, name: 'Sender' },
            { _id: otherId, name: 'Other User' }
          ],
          messages: ['msg1']
        }
      ];
      const latestMessage = { _id: 'msg1', from: otherId, to: senderId };

      mockChat.find.mockReturnValue({ populate: jest.fn().mockResolvedValue(chatRooms) });
      mockMessage.findOne.mockResolvedValue(latestMessage);

      await fGetRecentContact(req, res);

      const expectedOutput = {
        status: 'Success',
        data: [
          {
            contact: { _id: otherId, name: 'Other User' },
            latest_message: latestMessage,
            latest_sender: 'notMe'
          }
        ]
      };

      console.log('Test: should return contacts with latest message and sender status');
      console.log('Expected Output:', JSON.stringify(expectedOutput, null, 2));
      console.log('Actual Output:', JSON.stringify(res.send.mock.calls[0][0], null, 2));

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith(expectedOutput);
      expect(mockChat.find).toHaveBeenCalledWith({ membersID: { $size: 2, $all: [senderId] } });
    });
    // Chat08
    it('should return contacts with isMe sender', async () => {
      const chatRooms = [
        {
          _id: new mongoose.Types.ObjectId(),
          membersID: [
            { _id: senderId, name: 'Sender' },
            { _id: otherId, name: 'Other User' }
          ],
          messages: ['msg1']
        }
      ];
      const latestMessage = { _id: 'msg1', from: senderId, to: otherId };

      mockChat.find.mockReturnValue({ populate: jest.fn().mockResolvedValue(chatRooms) });
      mockMessage.findOne.mockResolvedValue(latestMessage);

      await fGetRecentContact(req, res);

      const expectedOutput = {
        status: 'Success',
        data: [
          {
            contact: { _id: otherId, name: 'Other User' },
            latest_message: latestMessage,
            latest_sender: 'isMe'
          }
        ]
      };

      console.log('Test: should return contacts with isMe sender');
      console.log('Expected Output:', JSON.stringify(expectedOutput, null, 2));
      console.log('Actual Output:', JSON.stringify(res.send.mock.calls[0][0], null, 2));

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith(expectedOutput);
    });
    // Chat09
    it('should return empty message for no messages', async () => {
      const chatRooms = [
        {
          _id: new mongoose.Types.ObjectId(),
          membersID: [
            { _id: senderId, name: 'Sender' },
            { _id: otherId, name: 'Other User' }
          ],
          messages: []
        }
      ];

      mockChat.find.mockReturnValue({ populate: jest.fn().mockResolvedValue(chatRooms) });

      await fGetRecentContact(req, res);

      const expectedOutput = {
        status: 'Success',
        data: [
          {
            contact: { _id: otherId, name: 'Other User' },
            latest_message: {},
            latest_sender: ''
          }
        ]
      };

      console.log('Test: should return empty message for no messages');
      console.log('Expected Output:', JSON.stringify(expectedOutput, null, 2));
      console.log('Actual Output:', JSON.stringify(res.send.mock.calls[0][0], null, 2));

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith(expectedOutput);
    });
    // Chat10
    it('should return empty array if no chat rooms', async () => {
      mockChat.find.mockReturnValue({ populate: jest.fn().mockResolvedValue([]) });

      await fGetRecentContact(req, res);

      console.log('Test: should return empty array if no chat rooms');
      console.log('Expected Output:', JSON.stringify({ status: 'Success', data: [] }, null, 2));
      console.log('Actual Output:', JSON.stringify(res.send.mock.calls[0][0], null, 2));

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith({ status: 'Success', data: [] });
    });
    // Chat11
    it('should handle invalid membersID size', async () => {
    const chatRooms = [
      {
        _id: new mongoose.Types.ObjectId(),
        membersID: [
          { _id: senderId, name: 'Sender' },
          { _id: otherId, name: 'Other User' },
          { _id: new mongoose.Types.ObjectId(), name: 'Extra User' }
        ],
        messages: []
      }
    ];

    mockChat.find.mockReturnValue({ populate: jest.fn().mockResolvedValue(chatRooms) });

    await fGetRecentContact(req, res);

    const expectedOutput = {
      status: 'Success',
      data: [] // Kỳ vọng mảng rỗng vì membersID có 3 thành viên
    };

    console.log('Test: should handle invalid membersID size');
    console.log('Expected Output:', JSON.stringify(expectedOutput, null, 2));
    console.log('Actual Output:', JSON.stringify(res.send.mock.calls[0][0], null, 2));

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith(expectedOutput);
  });

    // Chat12
    it('should handle sender as second member', async () => {
      const chatRooms = [
        {
          _id: new mongoose.Types.ObjectId(),
          membersID: [
            { _id: otherId, name: 'Other User' },
            { _id: senderId, name: 'Sender' }
          ],
          messages: ['msg1']
        }
      ];
      const latestMessage = { _id: 'msg1', from: otherId, to: senderId };

      mockChat.find.mockReturnValue({ populate: jest.fn().mockResolvedValue(chatRooms) });
      mockMessage.findOne.mockResolvedValue(latestMessage);

      await fGetRecentContact(req, res);

      const expectedOutput = {
        status: 'Success',
        data: [
          {
            contact: { _id: otherId, name: 'Other User' },
            latest_message: latestMessage,
            latest_sender: 'notMe'
          }
        ]
      };

      console.log('Test: should handle sender as second member');
      console.log('Expected Output:', JSON.stringify(expectedOutput, null, 2));
      console.log('Actual Output:', JSON.stringify(res.send.mock.calls[0][0], null, 2));

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith(expectedOutput);
    });
  });
});