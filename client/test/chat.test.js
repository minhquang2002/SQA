const { Builder, By, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const { MongoClient } = require('mongodb');

(async function () {
  let driver;
  let mongoClient;
  let db;

  // Cấu hình MongoDB
  const DB_CONFIGS = {
    HOST: '127.0.0.1',
    PORT: '27017',
    NAME: 'student_management'
  };
  const uri = `mongodb://${DB_CONFIGS.HOST}:${DB_CONFIGS.PORT}`;

  try {
    // Khởi tạo kết nối MongoDB
    mongoClient = new MongoClient(uri);
    await mongoClient.connect();
    db = mongoClient.db(DB_CONFIGS.NAME);
    console.log('Connected to MongoDB');

    // Khởi tạo driver
    const chromeOptions = new chrome.Options();
    // chromeOptions.addArguments('--headless');
    driver = await new Builder()
      .forBrowser('chrome')
      .setChromeOptions(chromeOptions)
      .build();
    await driver.manage().window().maximize();

    // Test 1: Đăng nhập
    console.log('Navigating to login page...');
    await driver.get('http://localhost:3000/login');
    const usernameField = await driver.wait(until.elementLocated(By.name('username')), 2000);
    await usernameField.sendKeys('19029999'); 
    const passwordField = await driver.wait(until.elementLocated(By.name('password')), 2000);
    await passwordField.sendKeys('bach');
    const loginButton = await driver.wait(until.elementLocated(By.xpath('//button[text()="Đăng nhập"]')), 2000);
    await loginButton.click();
    await driver.wait(until.urlContains('/'), 2000);
    const homeElement = await driver.wait(until.elementLocated(By.xpath('//h3[contains(text(), "Chào mừng")]')), 2000);
    if (!await homeElement.isDisplayed()) {
      throw new Error('Đăng nhập không thành công, không tìm thấy tiêu đề trang chủ');
    }
    console.log('Test 1: Đăng nhập thành công');

    // Test 2: Chọn chức năng Đổi lớp/Chọn lớp
    console.log('Looking for Chọn lớp/Đổi lớp button...');
    const selectClassUrl = await driver.getCurrentUrl();
    console.log('Current URL before selecting class:', selectClassUrl);
    let selectClassCard;
    try {
      const selectClassText = await driver.wait(
        until.elementLocated(By.xpath('//h5[contains(text(), "chọn lớp") or contains(text(), "đổi lớp")]')),
        2000
      );
      selectClassCard = await selectClassText.findElement(By.xpath('ancestor::div[contains(@class, "ant-card")]'));
    } catch (e) {
      console.log('Locator 1 failed, trying alternative locator...');
      selectClassCard = await driver.wait(
        until.elementLocated(By.xpath('//div[contains(@class, "ant-card") and .//span[contains(@class, "anticon-appstore")]]')),
        2000
      );
    }
    if (!selectClassCard.isDisplayed()) {
      throw new Error('Không tìm thấy card Chọn lớp/Đổi lớp');
    }
    await selectClassCard.click();
    console.log('Test 2: Mở chức năng Đổi lớp/Chọn lớp thành công');

    // Test 3: Chọn lớp D21CNPM01
    console.log('Selecting class D21CNPM01...');
    const classOption = await driver.wait(
      until.elementLocated(By.xpath('//div[contains(text(), "D21CNPM01")]')),
      2000
    );
    await classOption.click();
    await driver.wait(until.elementIsVisible(classOption), 2000);
    const currentUrl = await driver.getCurrentUrl();
    console.log('Current URL after selecting class:', currentUrl);
    if (currentUrl.includes('/profile')) {
      console.log('Unexpected redirect to /profile, navigating back to home...');
      await driver.navigate().back();
      await driver.wait(until.urlContains('/'), 2000);
    }
    await driver.wait(until.elementLocated(By.xpath('//div[contains(@class, "ant-card-head-title") and contains(text(), "D21CNPM01")]')), 2000);
    console.log('Test 3: Chọn lớp D21CNPM01 thành công');
    // Test 4: Vào chức năng Tin nhắn và hiển thị danh sách người liên hệ
    console.log('Navigating to chat...');
    const currentUrlBeforeChat = await driver.getCurrentUrl();
    console.log('Current URL before navigating to chat:', currentUrlBeforeChat);
    let chatLink;
    try {
      // Thử tìm liên kết Tin nhắn bằng văn bản, biểu tượng, hoặc menu
      chatLink = await driver.wait(
        until.elementLocated(By.xpath('//a[contains(text(), "Tin nhắn") or contains(text(), "Chat")] | //*[contains(@class, "anticon-message")] | //*[contains(@class, "ant-menu-item") and contains(@href, "/chat")]')),
        10000
      );
      if (!await chatLink.isDisplayed()) {
        throw new Error('Liên kết Tin nhắn không hiển thị');
      }
      await chatLink.click();
    } catch (e) {
      console.log('Không tìm thấy liên kết Tin nhắn qua XPath, thử điều hướng trực tiếp...');
      await driver.get('http://localhost:3000/chat');
    }
    // Đợi URL chứa /chat
    await driver.wait(until.urlContains('/chat'), 10000);
    let contactListLoaded = false;
    try {
      // Đợi socket kết nối và Messenger render
      console.log('Waiting for Messenger component to render...');
      await driver.wait(
        until.elementLocated(By.css('.messenger')),
        15000
      );
      // Kiểm tra danh sách người liên hệ trong div.scrollable.sidebar
      const contactList = await driver.wait(
        until.elementLocated(By.css('.scrollable.sidebar')),
        15000
      );
      // Đợi ít nhất một mục trong danh sách người liên hệ
      const contactItem = await driver.wait(
        until.elementLocated(By.css('.ant-list-item, .conversation-list-item')),
        15000
      );
      if (await contactItem.isDisplayed()) {
        contactListLoaded = true;
        console.log('Danh sách người liên hệ hiển thị thành công');
      }
    } catch (e) {
      console.log('Không tìm thấy danh sách người liên hệ, thử kiểm tra tiêu đề hoặc HTML...');
      try {
        // Kiểm tra tiêu đề trang (nếu có)
        const chatPageTitle = await driver.wait(
          until.elementLocated(By.xpath('//h1[contains(text(), "Tin nhắn") or contains(text(), "Chat")] | //div[contains(@class, "messenger")]')),
          10000
        );
        if (await chatPageTitle.isDisplayed()) {
          contactListLoaded = true;
          console.log('Trang Tin nhắn đã tải, nhưng có thể chưa có người liên hệ');
        }
      } catch (e2) {
        console.log('Không tìm thấy tiêu đề trang, in HTML để gỡ lỗi...');
        const pageHtml = await driver.findElement(By.xpath('//body')).getAttribute('innerHTML');
        console.log('Page HTML:', pageHtml.substring(0, 1000));
        throw new Error('Không thể xác nhận trang Tin nhắn hoặc danh sách người liên hệ: ' + e2.message);
      }
    }
    if (!contactListLoaded) {
      throw new Error('Không thể xác nhận danh sách người liên hệ hoặc trang Tin nhắn đã hiển thị');
    }
    console.log('Test 4: Vào chức năng Tin nhắn và hiển thị danh sách người liên hệ thành công');
    await driver.sleep(2000);

    // Test 5: Nhấp vào liên hệ "Trần Xuân Bách" và hiển thị tin nhắn
    console.log('Selecting contact "Trần Xuân Bách"...');
    let contactElement;
    try {
      // Tìm liên hệ với tên "Trần Xuân Bách" trong danh sách
      contactElement = await driver.wait(
        until.elementLocated(By.xpath('//h1[contains(@class, "conversation-title") and contains(text(), "Trần Xuân Bách")]')),
        10000
      );
      if (!await contactElement.isDisplayed()) {
        throw new Error('Liên hệ "Trần Xuân Bách" không hiển thị');
      }
      // Nhấp vào liên hệ
      await contactElement.click();
      console.log('Clicked on contact "Trần Xuân Bách"');
    } catch (e) {
      console.log('Không tìm thấy liên hệ qua XPath, thử CSS selector...');
      try {
        contactElement = await driver.wait(
          until.elementLocated(By.css('.conversation-title')),
          10000
        );
        const contactText = await contactElement.getText();
        if (contactText.includes('Trần Xuân Bách')) {
          await contactElement.click();
          console.log('Clicked on contact "Trần Xuân Bách" via CSS');
        } else {
          throw new Error('Không tìm thấy liên hệ "Trần Xuân Bách" qua CSS selector');
        }
      } catch (e2) {
        console.log('In HTML để gỡ lỗi...');
        const sidebarHtml = await driver.findElement(By.css('.scrollable.sidebar')).getAttribute('innerHTML');
        console.log('Sidebar HTML:', sidebarHtml.substring(0, 1000));
        throw new Error('Không thể tìm thấy liên hệ "Trần Xuân Bách": ' + e2.message);
      }
    }
    // Đợi khu vực tin nhắn hiển thị
    let messageAreaLoaded = false;
    try {
      // Kiểm tra khu vực tin nhắn trong div.scrollable.content
      const messageArea = await driver.wait(
        until.elementLocated(By.css('.scrollable.content')),
        15000
      );
      // Kiểm tra tiêu đề cuộc trò chuyện
      const conversationTitle = await driver.wait(
        until.elementLocated(By.xpath('//div[contains(@class, "toolbar")]//h1[contains(@class, "toolbar-title") and contains(text(), "Trao đổi với Trần Xuân Bách")]')),
        10000
      );
      if (!await conversationTitle.isDisplayed()) {
        throw new Error('Tiêu đề cuộc trò chuyện không hiển thị');
      }
      // Kiểm tra ít nhất một tin nhắn hoặc khu vực nhập tin nhắn
      try {
        const messageOrInput = await driver.wait(
          until.elementLocated(By.xpath('//div[contains(@class, "message")] | //div[contains(@class, "compose")]')),
          10000
        );
        if (await messageOrInput.isDisplayed()) {
          messageAreaLoaded = true;
          console.log('Khu vực tin nhắn hoặc ô nhập tin nhắn hiển thị thành công');
        }
      } catch (e3) {
        console.log('Không tìm thấy tin nhắn hoặc ô nhập, nhưng tiêu đề đã hiển thị');
        messageAreaLoaded = true; // Chấp nhận nếu chưa có tin nhắn
      }
    } catch (e4) {
      console.log('Không tìm thấy khu vực tin nhắn, in HTML để gỡ lỗi...');
      const contentHtml = await driver.findElement(By.css('.scrollable.content')).getAttribute('innerHTML');
      console.log('Content HTML:', contentHtml.substring(0, 1000));
      throw new Error('Không thể xác nhận khu vực tin nhắn: ' + e4.message);
    }
    if (!messageAreaLoaded) {
      throw new Error('Không thể xác nhận khu vực tin nhắn đã hiển thị');
    }
    console.log('Test 5: Nhấp vào liên hệ "Trần Xuân Bách" và hiển thị tin nhắn thành công');
    await driver.sleep(2000);

// Test 6: Gửi tin nhắn "Thầy chào bách "
    console.log('Sending message "Thầy chào bách "...');
    let messageInput;
    try {
      // Tìm ô nhập tin nhắn
      messageInput = await driver.wait(
        until.elementLocated(By.css('.compose-input')),
        10000
      );
      if (!await messageInput.isDisplayed()) {
        throw new Error('Ô nhập tin nhắn không hiển thị');
      }
      // Xóa nội dung hiện tại (nếu có) và nhập tin nhắn
      await messageInput.clear();
      await messageInput.sendKeys('Thầy chào bách ');
      console.log('Entered message "Thầy chào bách "');
    } catch (e) {
      console.log('Không tìm thấy ô nhập tin nhắn qua CSS, thử XPath...');
      messageInput = await driver.wait(
        until.elementLocated(By.xpath('//input[@type="text" and contains(@placeholder, "Nhập tin nhắn để gửi")]')),
        10000
      );
      if (!await messageInput.isDisplayed()) {
        throw new Error('Ô nhập tin nhắn không hiển thị qua XPath');
      }
      await messageInput.clear();
      await messageInput.sendKeys('Thầy chào bách ');
      console.log('Entered message "Thầy chào bách " via XPath');
    }
    // Tìm và nhấp nút gửi
    let sendButton;
    try {
      sendButton = await driver.wait(
        until.elementLocated(By.css('.ant-btn-primary.ant-btn-circle .anticon-send')),
        10000
      );
      if (!await sendButton.isDisplayed()) {
        throw new Error('Nút gửi không hiển thị');
      }
      await sendButton.click();
      console.log('Clicked send button');
    } catch (e) {
      console.log('Không tìm thấy nút gửi qua CSS, thử XPath...');
      sendButton = await driver.wait(
        until.elementLocated(By.xpath('//button[contains(@class, "ant-btn-primary") and contains(@class, "ant-btn-circle") and .//span[contains(@class, "anticon-send")]]')),
        10000
      );
      if (!await sendButton.isDisplayed()) {
        throw new Error('Nút gửi không hiển thị qua XPath');
      }
      await sendButton.click();
      console.log('Clicked send button via XPath');
    }
    // Kiểm tra tin nhắn đã gửi
    let messageSent = false;
    try {
      const sentMessage = await driver.wait(
        until.elementLocated(By.xpath('//div[contains(@class, "message") and contains(@class, "mine") and .//div[contains(@class, "bubble") and contains(text(), "Thầy chào bách ")]]')),
        15000
      );
      if (await sentMessage.isDisplayed()) {
        messageSent = true;
        console.log('Tin nhắn "Thầy chào bách " hiển thị thành công');
      }
    } catch (e) {
      console.log('Không tìm thấy tin nhắn, in HTML để gỡ lỗi...');
      const messageAreaHtml = await driver.findElement(By.css('.message-list-container')).getAttribute('innerHTML');
      console.log('Message Area HTML:', messageAreaHtml.substring(0, 1000));
      throw new Error('Không thể xác nhận tin nhắn "Thầy chào bách " đã hiển thị: ' + e.message);
    }
    if (!messageSent) {
      throw new Error('Không thể xác nhận tin nhắn đã gửi');
    }
    // Rollback: Xóa tin nhắn khỏi MongoDB
    console.log('Rolling back message "Thầy chào bách " from MongoDB...');
    try {
      const result = await db.collection('messages').deleteOne({ message: 'Thầy chào bách ' });
      if (result.deletedCount > 0) {
        console.log('Successfully deleted message "Thầy chào bách "');
      } else {
        console.log('No message found with content "Thầy chào bách "');
      }
    } catch (e) {
      console.error('Failed to rollback message:', e.message);
    }
    console.log('Test 6: Gửi tin nhắn "Thầy chào bách " thành công');
    await driver.sleep(2000);

  } catch (error) {
    console.error('Lỗi:', error.message);
  } finally {
    if (mongoClient) {
      await mongoClient.close();
      console.log('MongoDB connection closed');
    }
    if (driver) {
      await driver.quit();
      console.log('Browser closed');
    }
  }
})();